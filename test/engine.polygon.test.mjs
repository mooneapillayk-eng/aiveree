import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import {
  mapAggs,
  mapOptionsSnapshot,
  mapFundamentals,
  assembleSnapshot,
  PolygonProvider,
} from '../engine/data/polygonProvider.mjs';
import { evaluateOpportunity } from '../engine/opportunity.mjs';

const AS_OF = '2026-07-17';
const EXPIRY = '2026-08-21'; // 35 DTE from AS_OF -> inside the 25-45 window
const DAY = 86_400_000;
const T0 = new Date('2025-08-01T00:00:00Z').getTime();

function sampleAggs(days = 260, start = 120, drift = 0.1) {
  const results = [];
  for (let i = 0; i < days; i++) {
    results.push({ t: T0 + i * DAY, o: start, h: start, l: start, c: start + i * drift + Math.sin(i / 9) * 2, v: 1_000_000 + (i % 5) * 40_000 });
  }
  return { results, resultsCount: results.length };
}

function sampleOptionResults(spot) {
  const out = [];
  for (let k = Math.round(spot * 0.8); k <= spot * 1.2; k += 5) {
    const callDelta = Math.max(0.02, Math.min(0.98, 0.5 - (k - spot) / (spot * 0.5)));
    out.push({
      details: { contract_type: 'call', strike_price: k, expiration_date: EXPIRY },
      greeks: { delta: callDelta },
      implied_volatility: 0.44,
      open_interest: 900,
      day: { volume: 130 },
      last_quote: { bid: 2.0, ask: 2.1, midpoint: 2.05 },
    });
    out.push({
      details: { contract_type: 'put', strike_price: k, expiration_date: EXPIRY },
      greeks: { delta: -Math.max(0.02, Math.min(0.98, 0.5 + (k - spot) / (spot * 0.5))) },
      implied_volatility: 0.46,
      open_interest: 950,
      day: { volume: 140 },
      last_quote: { bid: 2.2, ask: 2.3, midpoint: 2.25 },
    });
  }
  return out;
}

const sampleTicker = { results: { market_cap: 260_000_000_000, weighted_shares_outstanding: 1_600_000_000 } };
const sampleFinancials = {
  results: [
    { financials: { income_statement: { revenues: { value: 6_000_000_000 }, gross_profit: { value: 3_000_000_000 } }, balance_sheet: { equity: { value: 50_000_000_000 }, liabilities: { value: 5_000_000_000 } } } },
    { financials: { income_statement: { revenues: { value: 5_800_000_000 } } } },
    { financials: { income_statement: { revenues: { value: 5_500_000_000 } } } },
    { financials: { income_statement: { revenues: { value: 5_200_000_000 } } } },
    { financials: { income_statement: { revenues: { value: 4_900_000_000 } } } }, // ~1y ago
  ],
};
const sampleShort = { results: [{ short_interest_percent_of_float: 0.031, days_to_cover: 1.4 }] };

describe('Polygon mappers', () => {
  it('mapAggs builds history + last price from daily bars', () => {
    const a = mapAggs(sampleAggs(5, 100, 0));
    expect(a.history).toHaveLength(5);
    expect(a.history[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.price).toBeGreaterThan(0);
    expect(a.avgVolume).toBeGreaterThan(0);
  });

  it('mapOptionsSnapshot uses VENDOR greeks and keeps only in-window expiries', () => {
    const spot = 150;
    const chain = mapOptionsSnapshot(sampleOptionResults(spot), { asOf: AS_OF, config: CONFIG });
    expect(chain.expirations.length).toBe(1);
    const exp = chain.expirations[0];
    expect(exp.dte).toBeGreaterThanOrEqual(CONFIG.opportunity.dteMin);
    expect(exp.dte).toBeLessThanOrEqual(CONFIG.opportunity.dteMax);
    expect(exp.puts.every((p) => p.delta <= 0)).toBe(true);
    expect(exp.calls.every((c) => c.delta >= 0)).toBe(true);
    // a ~30-delta put exists to sell
    expect(exp.puts.some((p) => Math.abs(p.delta) > 0.2 && Math.abs(p.delta) < 0.45)).toBe(true);
  });

  it('mapFundamentals derives P/S, growth, margin, leverage and short interest', () => {
    const { fundamentals, shortInterest } = mapFundamentals({
      tickerDetails: sampleTicker,
      financials: sampleFinancials,
      shortInterest: sampleShort,
      price: 150,
    });
    // TTM revenue = 6.0+5.8+5.5+5.2 = 22.5B ; P/S = 260B / 22.5B ~ 11.56
    expect(fundamentals.priceToSales).toBeGreaterThan(10);
    expect(fundamentals.grossMargin).toBeCloseTo(0.5, 1);
    expect(fundamentals.debtToEquity).toBeCloseTo(0.1, 2);
    expect(fundamentals.revenueGrowthYoY).toBeGreaterThan(0);
    expect(shortInterest.percentFloat).toBe(0.031);
  });

  it('assembleSnapshot yields a snapshot the engine can score', () => {
    const aggs = sampleAggs();
    const spot = mapAggs(aggs).price;
    const snap = assembleSnapshot({
      symbol: 'AMD',
      asOf: AS_OF,
      aggsJson: aggs,
      optionResults: sampleOptionResults(spot),
      fundamentalsInputs: { tickerDetails: sampleTicker, financials: sampleFinancials, shortInterest: sampleShort },
      config: CONFIG,
    });
    expect(snap.optionChain.expirations.length).toBe(1);
    expect(snap.earnings.nextDate).toBeNull(); // supplied later by the overlay
    const opp = evaluateOpportunity(snap, CONFIG, { ownsShares: false });
    expect(opp).toHaveProperty('composite');
  });

  it('degrades gracefully when fundamentals are missing', () => {
    const snap = assembleSnapshot({
      symbol: 'AMD',
      asOf: AS_OF,
      aggsJson: sampleAggs(),
      optionResults: [],
      fundamentalsInputs: null,
      config: CONFIG,
    });
    expect(snap.fundamentals).toEqual({});
    expect(() => evaluateOpportunity(snap, CONFIG, { ownsShares: false })).not.toThrow();
  });
});

describe('Polygon provider wiring', () => {
  it('throws a clear error without an API key', () => {
    const cfg = structuredClone(CONFIG);
    cfg.polygon.apiKey = null;
    expect(() => new PolygonProvider(cfg)).toThrow(/POLYGON_API_KEY/);
  });

  it('is discovery- and IV-store-capable with a key', async () => {
    const cfg = structuredClone(CONFIG);
    cfg.polygon.apiKey = 'test-key';
    const p = new PolygonProvider(cfg);
    expect(p.name).toBe('polygon');
    expect(p.supportsDiscovery).toBe(true);
    expect(p.usesIvStore).toBe(true);
    expect(p.usesEarningsOverride).toBe(true);
    expect(await p.listCandidates()).toEqual(CONFIG.live.candidateList);
  });
});

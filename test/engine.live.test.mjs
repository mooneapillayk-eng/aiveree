import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import { createProvider } from '../engine/data/provider.mjs';
import {
  bsDelta,
  computeIvRankProxy,
  mapChart,
  mapFundamentals,
  mapOptionContract,
  assembleChain,
  assembleSnapshot,
} from '../engine/data/liveProvider.mjs';
import { evaluateOpportunity } from '../engine/opportunity.mjs';

// ── Sample Yahoo payloads (shapes match the real endpoints) ──────────────────
const DAY = 86_400;
const START = 1_700_000_000; // fixed base so tests are deterministic

function sampleChart(days = 260, start = 60, drift = 0.05) {
  const timestamp = [];
  const close = [];
  const volume = [];
  for (let i = 0; i < days; i++) {
    timestamp.push(START + i * DAY);
    close.push(start + i * drift + Math.sin(i / 10) * 1.5);
    volume.push(1_000_000 + (i % 7) * 50_000);
  }
  const last = close[close.length - 1];
  return {
    chart: {
      result: [
        {
          meta: { symbol: 'AMD', regularMarketPrice: last, chartPreviousClose: close[close.length - 2] },
          timestamp,
          indicators: { quote: [{ close, volume }] },
        },
      ],
    },
  };
}

const sampleSummary = {
  quoteSummary: {
    result: [
      {
        summaryDetail: {
          priceToSalesTrailing12Months: { raw: 6.2 },
          forwardPE: { raw: 24 },
          marketCap: { raw: 260_000_000_000 },
        },
        defaultKeyStatistics: { shortPercentOfFloat: { raw: 0.031 }, shortRatio: { raw: 1.4 } },
        financialData: {
          revenueGrowth: { raw: 0.22 },
          grossMargins: { raw: 0.5 },
          totalCashPerShare: { raw: 5.4 },
          debtToEquity: { raw: 8.0 }, // Yahoo reports as a percent -> 0.08
        },
        calendarEvents: { earnings: { earningsDate: [{ raw: START + 300 * DAY }] } },
      },
    ],
  },
};

function sampleOptionPayload(spot, dteDays) {
  const expUnix = START + (259 + dteDays) * DAY;
  const strikes = [];
  for (let k = Math.round(spot * 0.8); k <= spot * 1.2; k += 5) strikes.push(k);
  const mk = (strike, right) => ({
    strike,
    bid: 1.0,
    ask: 1.1,
    impliedVolatility: 0.45,
    openInterest: 800,
    volume: 120,
    expiration: expUnix,
  });
  return {
    optionChain: {
      result: [
        {
          expirationDates: [expUnix],
          options: [{ expirationDate: expUnix, calls: strikes.map((s) => mk(s, 'call')), puts: strikes.map((s) => mk(s, 'put')) }],
        },
      ],
    },
  };
}

// ── tests ────────────────────────────────────────────────────────────────────
describe('Black-Scholes delta', () => {
  it('signs puts negative and calls positive, with sane magnitudes', () => {
    const put = bsDelta({ spot: 100, strike: 92, dte: 35, iv: 0.4, right: 'put' });
    const call = bsDelta({ spot: 100, strike: 108, dte: 35, iv: 0.4, right: 'call' });
    expect(put).toBeLessThan(0);
    expect(Math.abs(put)).toBeGreaterThan(0.1);
    expect(Math.abs(put)).toBeLessThan(0.5);
    expect(call).toBeGreaterThan(0);
    expect(call).toBeLessThan(0.5);
  });

  it('an at-the-money option is near 0.5 delta', () => {
    const atm = bsDelta({ spot: 100, strike: 100, dte: 30, iv: 0.4, right: 'call' });
    expect(atm).toBeGreaterThan(0.5);
    expect(atm).toBeLessThan(0.65);
  });
});

describe('IV-rank proxy', () => {
  it('returns an integer percentile in [0,100]', () => {
    const { history } = mapChart(sampleChart());
    const rank = computeIvRankProxy(history);
    expect(Number.isInteger(rank)).toBe(true);
    expect(rank).toBeGreaterThanOrEqual(0);
    expect(rank).toBeLessThanOrEqual(100);
  });

  it('returns null for too-short history', () => {
    expect(computeIvRankProxy([{ close: 1 }, { close: 2 }])).toBeNull();
  });
});

describe('Yahoo -> snapshot mappers', () => {
  it('mapChart builds ISO-dated history and a last price', () => {
    const c = mapChart(sampleChart(5, 100, 0));
    expect(c.history).toHaveLength(5);
    expect(c.history[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(c.price).toBeGreaterThan(0);
  });

  it('mapFundamentals scales debt/equity and converts the earnings date', () => {
    const { fundamentals, shortInterest, earnings } = mapFundamentals(sampleSummary);
    expect(fundamentals.priceToSales).toBe(6.2);
    expect(fundamentals.debtToEquity).toBe(0.08); // 8.0% -> 0.08
    expect(shortInterest.percentFloat).toBe(0.031);
    expect(earnings.nextDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('mapOptionContract computes a delta from IV', () => {
    const opt = mapOptionContract(
      { strike: 92, bid: 1, ask: 1.1, impliedVolatility: 0.4, openInterest: 500, volume: 50 },
      { spot: 100, dte: 35, right: 'put', riskFreeRate: 0.04 }
    );
    expect(opt.delta).toBeLessThan(0);
    expect(opt.iv).toBe(0.4);
  });

  it('assembleSnapshot produces a snapshot the opportunity engine can score', () => {
    const spot = mapChart(sampleChart()).price;
    const snap = assembleSnapshot({
      symbol: 'AMD',
      asOf: '2024-06-01',
      chartJson: sampleChart(),
      summaryJson: sampleSummary,
      expiryPayloads: [sampleOptionPayload(spot, 35)],
      config: CONFIG,
    });
    expect(snap.symbol).toBe('AMD');
    expect(snap.optionChain.expirations.length).toBeGreaterThan(0);
    expect(snap.optionChain.expirations[0].puts.some((p) => p.delta < 0)).toBe(true);
    expect(typeof snap.ivRank).toBe('number');
    // The real engine can consume it without throwing.
    const opp = evaluateOpportunity(snap, CONFIG, { ownsShares: false });
    expect(opp).toHaveProperty('composite');
  });

  it('degrades gracefully when fundamentals are missing', () => {
    const snap = assembleSnapshot({
      symbol: 'AMD',
      asOf: '2024-06-01',
      chartJson: sampleChart(),
      summaryJson: null, // fundamentals endpoint failed
      expiryPayloads: [],
      config: CONFIG,
    });
    expect(snap.fundamentals).toEqual({});
    expect(snap.earnings.nextDate).toBeNull();
    // Still scoreable — lenses guard missing fields.
    expect(() => evaluateOpportunity(snap, CONFIG, { ownsShares: false })).not.toThrow();
  });
});

describe('live provider wiring', () => {
  it('createProvider("live") returns a discovery-capable Yahoo provider', () => {
    const cfg = structuredClone(CONFIG);
    cfg.dataProvider = 'live';
    const p = createProvider(cfg);
    expect(p.name).toBe('yahoo');
    expect(p.supportsDiscovery).toBe(true);
  });

  it('listCandidates returns the configured candidate list', async () => {
    const cfg = structuredClone(CONFIG);
    cfg.dataProvider = 'live';
    const p = createProvider(cfg);
    const list = await p.listCandidates();
    expect(list).toEqual(CONFIG.live.candidateList);
  });
});

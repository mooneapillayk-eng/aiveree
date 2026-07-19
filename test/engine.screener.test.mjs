import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import { createProvider } from '../engine/data/provider.mjs';
import { screenUniverse, scoreCandidate } from '../engine/screener.mjs';

// Minimal synthetic snapshot (enough for the lenses to score a candidate).
function snap(symbol, { price, iv, ps, growth = 0.3, de = 0.1, shortFloat = 0.12, earnings = '2026-12-01' }) {
  const history = [];
  for (let t = 0; t < 220; t++) history.push({ date: '2026-01-01', close: 50 + t * 0.1, volume: 0 });
  return {
    symbol,
    asOf: '2026-07-17',
    price,
    prevClose: price,
    volume: 2_000_000,
    avgVolume: 2_000_000,
    history,
    fundamentals: {
      priceToSales: ps,
      forwardPe: 20,
      revenueGrowthYoY: growth,
      grossMargin: 0.5,
      cashPerShare: 2,
      debtToEquity: de,
      marketCap: 1e10,
    },
    shortInterest: { percentFloat: shortFloat, daysToCover: 3 },
    earnings: { nextDate: earnings },
    ivRank: iv,
    optionChain: { asOf: '2026-07-17', expirations: [] },
  };
}

const SNAPS = {
  NEWGOOD: snap('NEWGOOD', { price: 72, iv: 60, ps: 2 }), // cheap, high IV, good positioning
  NEWBAD: snap('NEWBAD', { price: 72, iv: 10, ps: 15 }), // IV too low + expensive
  NEWSOON: snap('NEWSOON', { price: 72, iv: 60, ps: 2, earnings: '2026-07-20' }), // earnings blackout
};

function fakeLiveProvider(list) {
  return {
    name: 'fake-live',
    asOf: '2026-07-17',
    supportsDiscovery: true,
    async listCandidates() {
      return list;
    },
    async fetchSnapshot(symbol) {
      if (!SNAPS[symbol]) throw new Error(`no snapshot for ${symbol}`);
      return SNAPS[symbol];
    },
  };
}

describe('screener — dormant on the mock provider', () => {
  it('returns the base universe unchanged and reports why it is dormant', async () => {
    const provider = createProvider(CONFIG); // mock, no discovery
    const res = await screenUniverse(CONFIG, provider, { baseUniverse: ['AMD', 'MU'] });
    expect(res.dormant).toBe(true);
    expect(res.universe).toEqual(['AMD', 'MU']);
    expect(res.promoted).toEqual([]);
    expect(res.reason).toMatch(/no discovery/i);
  });
});

describe('scoreCandidate ranking', () => {
  it('marks a cheap, high-IV, well-positioned name eligible', () => {
    const s = scoreCandidate(SNAPS.NEWGOOD, CONFIG);
    expect(s.eligible).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(CONFIG.screener.minScreenScore);
    // short interest and IV rank are part of the recorded rationale
    expect(s.reasons.join(' ')).toMatch(/short/);
    expect(s.reasons.join(' ')).toMatch(/IVrank/);
  });

  it('rejects a low-IV, expensive name', () => {
    expect(scoreCandidate(SNAPS.NEWBAD, CONFIG).eligible).toBe(false);
  });

  it('rejects an otherwise-good name inside its earnings blackout', () => {
    expect(scoreCandidate(SNAPS.NEWSOON, CONFIG).eligible).toBe(false);
  });
});

describe('screener — live discovery path', () => {
  it('promotes eligible new names and skips base names, blackouts and low-IV', async () => {
    const provider = fakeLiveProvider(['AMD', 'NEWGOOD', 'NEWBAD', 'NEWSOON']);
    const res = await screenUniverse(CONFIG, provider, { baseUniverse: ['AMD', 'MU'] });
    expect(res.dormant).toBe(false);
    const promoted = res.promoted.map((p) => p.symbol);
    expect(promoted).toContain('NEWGOOD');
    expect(promoted).not.toContain('NEWBAD');
    expect(promoted).not.toContain('NEWSOON');
    expect(promoted).not.toContain('AMD'); // already in base
    expect(res.universe).toEqual(expect.arrayContaining(['AMD', 'MU', 'NEWGOOD']));
  });

  it('respects maxNewCandidates', async () => {
    const cfg = structuredClone(CONFIG);
    cfg.screener.maxNewCandidates = 0;
    const provider = fakeLiveProvider(['NEWGOOD']);
    const res = await screenUniverse(cfg, provider, { baseUniverse: ['AMD'] });
    expect(res.promoted).toHaveLength(0);
    expect(res.universe).toEqual(['AMD']);
  });
});

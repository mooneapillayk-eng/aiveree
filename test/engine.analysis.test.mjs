import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import { fixtureFor } from '../engine/data/fixtures.mjs';
import { sma, range52w, fibRetracement, analyzeTechnical } from '../engine/analysis/technical.mjs';
import { analyzeValuation } from '../engine/analysis/valuation.mjs';
import { analyzePositioning, putCallOiRatio } from '../engine/analysis/positioning.mjs';

describe('technical indicators', () => {
  const amd = fixtureFor('AMD');

  it('sma equals the mean of the last N closes', () => {
    const period = 50;
    const manual =
      amd.history.slice(-period).reduce((a, b) => a + b.close, 0) / period;
    expect(sma(amd.history, period)).toBeCloseTo(Math.round(manual * 100) / 100, 2);
  });

  it('sma returns null when history is too short', () => {
    expect(sma(amd.history.slice(0, 10), 50)).toBeNull();
  });

  it('range52w brackets the price and fib position is within [0,1]', () => {
    const { hi, lo } = range52w(amd.history);
    expect(hi).toBeGreaterThan(lo);
    const fib = fibRetracement(amd.history, amd.price);
    expect(fib.positionInRange).toBeGreaterThanOrEqual(0);
    expect(fib.positionInRange).toBeLessThanOrEqual(1);
    expect(fib.levels).toHaveLength(7);
  });

  it('flags AMD as a constructive pullback in an uptrend', () => {
    const t = analyzeTechnical(amd, CONFIG);
    expect(t.trend).toBe('up');
    expect(t.pullbackToSupport).toBe(true);
    expect(t.score).toBeGreaterThan(0);
  });
});

describe('valuation lens', () => {
  it('labels a low P/S, high-growth name as cheap', () => {
    const v = analyzeValuation(fixtureFor('XPEV'), CONFIG);
    expect(v.label).toBe('cheap');
    expect(v.score).toBeGreaterThan(0);
  });

  it('does not label a very high P/S name as cheap', () => {
    const v = analyzeValuation(fixtureFor('EH'), CONFIG);
    expect(v.label).not.toBe('cheap');
    expect(v.reasons.join(' ')).toMatch(/richly valued/);
  });
});

describe('positioning lens', () => {
  it('rewards elevated IV rank for premium selling', () => {
    const p = analyzePositioning(fixtureFor('EH'), CONFIG); // IV rank 72
    expect(p.score).toBeGreaterThan(0);
    expect(p.reasons.join(' ')).toMatch(/IV rank/);
  });

  it('computes a put/call OI ratio from the front month', () => {
    const r = putCallOiRatio(fixtureFor('AMD'));
    expect(typeof r).toBe('number');
    expect(r).toBeGreaterThan(0);
  });
});

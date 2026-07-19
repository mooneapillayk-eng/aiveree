import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import { fixtureFor } from '../engine/data/fixtures.mjs';
import { evaluateOpportunity, daysUntil } from '../engine/opportunity.mjs';
import { selectStrategy, isLiquid, pickPutByDelta, pickExpiration } from '../engine/strategy.mjs';

describe('opportunity engine', () => {
  it('stands aside when earnings fall inside the blackout window', () => {
    const o = evaluateOpportunity(fixtureFor('XPEV'), CONFIG, { ownsShares: false });
    expect(o.tradable).toBe(false);
    expect(o.notes.join(' ')).toMatch(/Earnings in/);
  });

  it('proposes selling puts on a bullish, elevated-IV pullback', () => {
    const o = evaluateOpportunity(fixtureFor('AMD'), CONFIG, { ownsShares: false });
    expect(o.intent).toBe('sell_put');
    expect(o.bias).not.toBe('bearish');
    expect(o.tradable).toBe(true);
  });

  it('proposes a covered call when we own shares in a rich/extended name', () => {
    const o = evaluateOpportunity(fixtureFor('EH'), CONFIG, { ownsShares: true });
    expect(o.intent).toBe('covered_call');
  });

  it('does not propose a covered call on the same name when we hold no shares', () => {
    const o = evaluateOpportunity(fixtureFor('EH'), CONFIG, { ownsShares: false });
    expect(o.intent).not.toBe('covered_call');
  });

  it('daysUntil computes calendar-day distance', () => {
    expect(daysUntil('2026-07-21', '2026-07-17')).toBe(4);
    expect(daysUntil(null, '2026-07-17')).toBeNull();
  });
});

describe('strategy selector', () => {
  it('selects a cash-secured put for AMD', () => {
    const snap = fixtureFor('AMD');
    const o = evaluateOpportunity(snap, CONFIG, { ownsShares: false });
    const s = selectStrategy(snap, o, CONFIG, { sharesOwned: 0 });
    expect(s.type).toBe('cash_secured_put');
    expect(Math.abs(s.shortDelta)).toBeGreaterThan(0.2);
    expect(Math.abs(s.shortDelta)).toBeLessThan(0.45);
    expect(s.creditPerContract).toBeGreaterThan(0);
    expect(s.breakeven).toBeLessThan(snap.price);
  });

  it('rejects a symbol with a thin option chain on liquidity', () => {
    const snap = fixtureFor('BE');
    const o = evaluateOpportunity(snap, CONFIG, { ownsShares: false });
    const s = selectStrategy(snap, o, CONFIG, { sharesOwned: 0 });
    expect(s.type).toBe('none');
    expect(s.reason).toMatch(/liquid/i);
  });

  it('falls back to a defined-risk put spread when the CSP is too big for the per-name cap', () => {
    const snap = fixtureFor('AMD');
    const tight = structuredClone(CONFIG);
    tight.risk.maxNotionalPerNamePct = 0.05; // $5k cap < CSP collateral
    tight.risk.minCreditToWidthRatio = 0.15; // accept this fixture's spread credit
    const o = evaluateOpportunity(snap, tight, { ownsShares: false });
    const s = selectStrategy(snap, o, tight, { sharesOwned: 0 });
    expect(s.type).toBe('put_spread');
    expect(s.width).toBe(tight.opportunity.putSpreadWidth);
    // Defined risk: max loss is bounded by the width, not the strike.
    expect(s.maxLossPerContract).toBeLessThanOrEqual(s.width * 100);
  });

  it('builds a covered call against 100 shares', () => {
    const snap = fixtureFor('EH');
    const o = evaluateOpportunity(snap, CONFIG, { ownsShares: true });
    const s = selectStrategy(snap, o, CONFIG, { sharesOwned: 100 });
    expect(s.type).toBe('covered_call');
    expect(s.maxContractsFromShares).toBe(1);
  });

  it('picks an expiry inside the DTE window', () => {
    const exp = pickExpiration(fixtureFor('AMD'), CONFIG);
    expect(exp.dte).toBeGreaterThanOrEqual(CONFIG.opportunity.dteMin);
    expect(exp.dte).toBeLessThanOrEqual(CONFIG.opportunity.dteMax);
  });

  it('isLiquid rejects low open interest', () => {
    expect(isLiquid({ bid: 1, ask: 1.02, openInterest: 10, volume: 50 }, CONFIG)).toBe(false);
    expect(isLiquid({ bid: 1, ask: 1.02, openInterest: 999, volume: 50 }, CONFIG)).toBe(true);
  });
});

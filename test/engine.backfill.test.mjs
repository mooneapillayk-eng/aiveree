import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import {
  bsPrice,
  impliedVol,
  thirdFriday,
  pickMonthlyExpiry,
  nearestStandardStrike,
  occTicker,
  ivSampleFromClose,
} from '../engine/backfill-iv.mjs';

describe('Black-Scholes price + IV inversion', () => {
  it('recovers the implied vol it was priced with (round-trip)', () => {
    const inputs = { spot: 150, strike: 145, T: 35 / 365, r: 0.04, right: 'call' };
    const price = bsPrice({ ...inputs, sigma: 0.42 });
    const iv = impliedVol({ ...inputs, price });
    expect(iv).toBeCloseTo(0.42, 2);
  });

  it('recovers vol for a put too', () => {
    const inputs = { spot: 80, strike: 82, T: 30 / 365, r: 0.04, right: 'put' };
    const price = bsPrice({ ...inputs, sigma: 0.6 });
    expect(impliedVol({ ...inputs, price })).toBeCloseTo(0.6, 2);
  });

  it('returns null for a price below intrinsic (no-arb violation)', () => {
    // Deep ITM call worth < intrinsic can't imply a vol.
    const iv = impliedVol({ price: 1, spot: 150, strike: 100, T: 30 / 365, r: 0.04, right: 'call' });
    expect(iv).toBeNull();
  });
});

describe('expiry + strike + OCC helpers', () => {
  it('thirdFriday finds the standard monthly expiry', () => {
    // 3rd Friday of Aug 2026 is the 21st.
    expect(thirdFriday(2026, 7).toISOString().slice(0, 10)).toBe('2026-08-21');
    // 3rd Friday of Jan 2027 is the 15th.
    expect(thirdFriday(2027, 0).toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('pickMonthlyExpiry returns an expiry inside the DTE window', () => {
    const exp = pickMonthlyExpiry('2026-07-17', CONFIG);
    expect(exp.dte).toBeGreaterThanOrEqual(CONFIG.opportunity.dteMin);
    expect(exp.dte).toBeLessThanOrEqual(CONFIG.opportunity.dteMax);
    expect(exp.expiry).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('nearestStandardStrike scales the increment with price', () => {
    expect(nearestStandardStrike(12.4)).toBe(12); // <25 -> $1
    expect(nearestStandardStrike(147)).toBe(145); // <200 -> $5
    expect(nearestStandardStrike(613)).toBe(610); // >=200 -> $10
  });

  it('occTicker formats the OCC option symbol correctly', () => {
    expect(occTicker('AMD', '2026-08-21', 'call', 145)).toBe('O:AMD260821C00145000');
    expect(occTicker('EH', '2026-08-21', 'put', 27)).toBe('O:EH260821P00027000');
  });

  it('ivSampleFromClose inverts a historical option close to an IV', () => {
    // Price a 35-DTE ATM call at 40% vol, then confirm the sample recovers it.
    const spot = 150;
    const strike = 150;
    const price = bsPrice({ spot, strike, T: 35 / 365, r: 0.04, sigma: 0.4, right: 'call' });
    const iv = ivSampleFromClose({
      optionClose: price,
      spot,
      strike,
      expiryISO: '2026-08-21',
      dateISO: '2026-07-17',
      right: 'call',
      riskFreeRate: 0.04,
    });
    expect(iv).toBeGreaterThan(0.3);
    expect(iv).toBeLessThan(0.5);
  });
});

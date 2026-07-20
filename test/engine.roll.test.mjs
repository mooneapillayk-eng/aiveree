import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import { fixtureFor } from '../engine/data/fixtures.mjs';
import { markPosition, buildRoll, decideExit } from '../engine/manage.mjs';
import { Portfolio } from '../engine/portfolio.mjs';
import { runCycle } from '../engine/run.mjs';

function cspPosition(overrides = {}) {
  return {
    id: 'POS-0001',
    symbol: 'AMD',
    sector: 'semiconductors',
    type: 'cash_secured_put',
    contracts: 1,
    expiry: '2026-08-04', // ~18 DTE from the fixture as-of (2026-07-17)
    legs: [{ side: 'sell', right: 'put', strike: 145, iv: 0.42, price: 6.54 }],
    creditReceived: 654,
    collateral: 14500,
    maxLoss: 1635,
    status: 'open',
    ...overrides,
  };
}

describe('buildRoll', () => {
  it('builds a further-dated same-structure replacement from the chain', () => {
    const snap = fixtureFor('AMD'); // full chain, as-of 2026-07-17
    const pos = cspPosition();
    const mark = markPosition(pos, { spot: snap.price, iv: 0.42, asOf: snap.asOf, riskFreeRate: 0.04 });
    const roll = buildRoll(pos, snap, CONFIG, mark);
    expect(roll).toBeTruthy();
    expect(roll.newStructure.type).toBe('cash_secured_put');
    expect(roll.newStructure.dte).toBeGreaterThanOrEqual(CONFIG.opportunity.dteMin);
    // the roll must extend duration beyond the current expiry
    expect(roll.newStructure.dte).toBeGreaterThan(18);
    expect(typeof roll.netCredit).toBe('number');
  });

  it('refuses to roll when no further-dated expiry exists', () => {
    const snap = fixtureFor('AMD');
    // Position already dated far out -> no expiry in the window extends it.
    const pos = cspPosition({ expiry: '2027-01-01' });
    const mark = markPosition(pos, { spot: snap.price, iv: 0.42, asOf: snap.asOf, riskFreeRate: 0.04 });
    expect(buildRoll(pos, snap, CONFIG, mark)).toBeNull();
  });
});

describe('decideExit -> roll at the DTE cutoff', () => {
  it('rolls (not closes) when the near leg still holds value and it nets a credit', () => {
    // Spot near the strike so the near-dated put isn't at a profit target.
    const snap = { ...fixtureFor('AMD'), price: 146 };
    const d = decideExit(cspPosition(), snap, CONFIG);
    expect(d.action).toBe('roll');
    expect(d.reason).toMatch(/roll to/);
    expect(d.newStructure).toBeTruthy();
    expect(d.netCredit).toBeGreaterThanOrEqual(CONFIG.management.roll.minNetCreditTotal);
  });

  it('closes instead of rolling when rolling is disabled', () => {
    const cfg = structuredClone(CONFIG);
    cfg.management.roll.enabled = false;
    const snap = { ...fixtureFor('AMD'), price: 146 };
    const d = decideExit(cspPosition(), snap, cfg);
    expect(d.action).toBe('close');
    expect(d.reason).toMatch(/DTE exit/);
  });
});

describe('rolling end-to-end (mock)', () => {
  it('closes the near leg and opens a further-dated one in the same cycle', async () => {
    const cfg = structuredClone(CONFIG);
    cfg.statePath = '/dev/null';
    cfg.telegram = { botToken: null, chatId: null };
    const state = {
      cash: cfg.account.startingCash,
      startingCash: cfg.account.startingCash,
      currency: 'USD',
      holdings: {},
      // ITM-ish near-expiry put: holds value (no profit target), inside DTE window.
      positions: [cspPosition({ strike: 155, legs: [{ side: 'sell', right: 'put', strike: 155, iv: 0.42, price: 7 }], creditReceived: 700, collateral: 15500 })],
      orders: [],
      decisions: [],
      realizedPnl: 0,
      seq: 1,
    };
    const portfolio = new Portfolio(state, '/dev/null', cfg);
    const { report } = await runCycle(cfg, { portfolio, notify: false, persist: false });

    const rolled = report.exits.find((e) => e.symbol === 'AMD' && e.status === 'rolled');
    expect(rolled).toBeTruthy();
    expect(rolled.rolledToId).toBeTruthy();
    // The replacement is a new open AMD position dated further out.
    const open = portfolio.openPositions().filter((p) => p.symbol === 'AMD');
    expect(open.length).toBe(1);
    expect(open[0].id).toBe(rolled.rolledToId);
    expect(open[0].expiry > '2026-08-04').toBe(true);
  });
});

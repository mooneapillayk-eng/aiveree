import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import { markPosition, decideExit, settleAtExpiration } from '../engine/manage.mjs';
import { Portfolio } from '../engine/portfolio.mjs';
import { runCycle } from '../engine/run.mjs';

function cspPosition(overrides = {}) {
  return {
    id: 'POS-0001',
    symbol: 'AMD',
    sector: 'semiconductors',
    type: 'cash_secured_put',
    contracts: 1,
    expiry: '2026-08-21',
    legs: [{ side: 'sell', right: 'put', strike: 145, iv: 0.42, price: 6.54 }],
    creditReceived: 654,
    collateral: 14500,
    maxLoss: 1635,
    status: 'open',
    ...overrides,
  };
}

function snap(price, asOf, iv = 0.42) {
  return {
    symbol: 'AMD',
    asOf,
    price,
    optionChain: {
      expirations: [
        { dte: 30, calls: [{ strike: price, iv }], puts: [{ strike: price, iv }] },
      ],
    },
  };
}

describe('markPosition', () => {
  it('marks a short put and yields a mark P&L', () => {
    const m = markPosition(cspPosition(), { spot: 153, iv: 0.42, asOf: '2026-07-17', riskFreeRate: 0.04 });
    expect(m.dte).toBe(35);
    expect(m.costToClose).toBeGreaterThan(0);
    // just opened-ish: mark P&L within a sane band of the credit
    expect(m.markPnl).toBeLessThanOrEqual(654);
  });
});

describe('decideExit rules', () => {
  it('holds a fresh, mid-range position', () => {
    const d = decideExit(cspPosition(), snap(150, '2026-07-18'), CONFIG);
    expect(d.action).toBe('hold');
  });

  it('takes profit when the short put has decayed enough', () => {
    // Well OTM with time passed -> put cheap -> >=50% of credit captured.
    const d = decideExit(cspPosition(), snap(175, '2026-07-30'), CONFIG);
    expect(d.action).toBe('close');
    expect(d.reason).toMatch(/profit target/);
    expect(d.pnl).toBeGreaterThan(0);
    expect(d.cashDelta).toBeLessThan(0); // paid a small debit to close
  });

  it('stops out when the short put has blown out', () => {
    const d = decideExit(cspPosition(), snap(120, '2026-07-24'), CONFIG);
    expect(d.action).toBe('close');
    expect(d.reason).toMatch(/stop loss/);
    expect(d.pnl).toBeLessThan(0);
  });

  it('closes on the DTE cutoff when neither target nor stop hit', () => {
    // Near the money, ~20 DTE: not a big win or loss, but inside the DTE window.
    const d = decideExit(cspPosition({ expiry: '2026-08-05' }), snap(146, '2026-07-17'), CONFIG);
    expect(d.action).toBe('close');
    expect(d.reason).toMatch(/DTE exit/);
  });
});

describe('settleAtExpiration', () => {
  it('assigns a cash-secured put that finishes in the money', () => {
    const s = settleAtExpiration(cspPosition(), 140, '2026-08-21');
    expect(s.status).toBe('assigned');
    expect(s.sharesDelta).toBe(100);
    expect(s.cashDelta).toBe(-14500); // buy 100 @ 145
    expect(s.pnl).toBe(654); // credit kept
  });

  it('expires a cash-secured put worthless when out of the money', () => {
    const s = settleAtExpiration(cspPosition(), 150, '2026-08-21');
    expect(s.status).toBe('expired');
    expect(s.sharesDelta).toBe(0);
    expect(s.pnl).toBe(654);
  });

  it('has shares called away on an ITM covered call', () => {
    const cc = cspPosition({ type: 'covered_call', legs: [{ side: 'sell', right: 'call', strike: 27, iv: 0.85 }], creditReceived: 205, collateral: 0 });
    const s = settleAtExpiration(cc, 30, '2026-08-21');
    expect(s.status).toBe('assigned');
    expect(s.sharesDelta).toBe(-100);
    expect(s.cashDelta).toBe(2700); // sell 100 @ 27
  });

  it('settles a put spread to its bounded net intrinsic', () => {
    const spread = cspPosition({
      type: 'put_spread',
      legs: [
        { side: 'sell', right: 'put', strike: 145, iv: 0.42 },
        { side: 'buy', right: 'put', strike: 140, iv: 0.42 },
      ],
      creditReceived: 150,
      collateral: 500,
    });
    const s = settleAtExpiration(spread, 138, '2026-08-21'); // both ITM -> max loss
    expect(s.cashDelta).toBe(-500); // (145-140)*100
    expect(s.pnl).toBe(150 - 500);
  });
});

describe('managed close end-to-end (mock)', () => {
  function freshPortfolioWithOpenPosition(config) {
    const state = {
      cash: config.account.startingCash,
      startingCash: config.account.startingCash,
      currency: 'USD',
      holdings: { EH: 100 },
      // A short put near its DTE cutoff -> should be closed during the manage phase.
      positions: [cspPosition({ expiry: '2026-07-30' })],
      orders: [],
      decisions: [],
      realizedPnl: 0,
      seq: 1,
    };
    return new Portfolio(state, '/dev/null', config);
  }

  it('closes the open position before entries and books P&L', async () => {
    const cfg = structuredClone(CONFIG);
    cfg.statePath = '/dev/null';
    cfg.telegram = { botToken: null, chatId: null };
    const portfolio = freshPortfolioWithOpenPosition(cfg);

    const { report } = await runCycle(cfg, { portfolio, notify: false, persist: false });

    const amdExit = report.exits.find((e) => e.symbol === 'AMD');
    expect(amdExit).toBeTruthy();
    expect(amdExit.status).toBe('closed');
    // near expiry + out-of-the-money -> closed (profit target or DTE cutoff)
    expect(amdExit.reason).toMatch(/profit target|DTE exit/);
    // realized P&L recorded on the account
    expect(report.account.realizedPnl).not.toBe(0);
  });
});

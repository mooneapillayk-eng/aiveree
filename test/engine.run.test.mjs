import { describe, it, expect } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import { Portfolio } from '../engine/portfolio.mjs';
import { runCycle } from '../engine/run.mjs';

// Build a config that never touches disk or the network.
function testConfig() {
  const c = structuredClone(CONFIG);
  c.statePath = '/dev/null';
  c.telegram = { botToken: null, chatId: null };
  return c;
}

function freshPortfolio(config) {
  const state = {
    cash: config.account.startingCash,
    startingCash: config.account.startingCash,
    currency: 'USD',
    holdings: { EH: 100 },
    positions: [],
    orders: [],
    decisions: [],
    realizedPnl: 0,
    seq: 0,
  };
  return new Portfolio(state, '/dev/null', config);
}

async function run(config) {
  return runCycle(config, {
    portfolio: freshPortfolio(config),
    notify: false,
    persist: false,
    verbose: false,
  });
}

describe('full paper cycle over the fixtures', () => {
  it('takes exactly the two intended trades and rejects the other three', async () => {
    const { report } = await run(testConfig());

    const traded = report.trades.map((t) => t.symbol).sort();
    expect(traded).toEqual(['AMD', 'EH']);

    const noTrade = Object.fromEntries(report.noTrades.map((n) => [n.symbol, n.reason]));
    expect(noTrade.MU).toMatch(/correlation/i);
    expect(noTrade.XPEV).toMatch(/earnings/i);
    expect(noTrade.BE).toMatch(/liquid/i);
  });

  it('classifies the two trades as a CSP and a covered call', async () => {
    const { report } = await run(testConfig());
    const byType = Object.fromEntries(report.trades.map((t) => [t.symbol, t.structure.type]));
    expect(byType.AMD).toBe('cash_secured_put');
    expect(byType.EH).toBe('covered_call');
  });

  it('reconciles every filled order', async () => {
    const { report } = await run(testConfig());
    expect(report.reconciliation).toHaveLength(2);
    expect(report.reconciliation.every((r) => r.ok)).toBe(true);
  });

  it('collects premium and stays well within the exposure cap', async () => {
    const { report } = await run(testConfig());
    expect(report.account.creditThisRun).toBeGreaterThan(0);
    expect(report.account.cashAfter).toBeGreaterThan(report.account.startingCash);
    const exposure = report.account.committedAfter / report.account.startingCash;
    expect(exposure).toBeLessThan(CONFIG.risk.maxPortfolioNotionalPct);
  });

  it('is deterministic across identical runs', async () => {
    const a = await run(testConfig());
    const b = await run(testConfig());
    expect(a.summary).toBe(b.summary);
  });
});

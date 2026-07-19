import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG } from '../engine/config.mjs';
import { fixtureFor } from '../engine/data/fixtures.mjs';
import { evaluateOpportunity } from '../engine/opportunity.mjs';
import { selectStrategy } from '../engine/strategy.mjs';
import { assessRisk } from '../engine/risk.mjs';
import { buildLimitOrder, simulateFill, reconcile } from '../engine/execution.mjs';
import { Portfolio } from '../engine/portfolio.mjs';

function freshPortfolio(overrides = {}) {
  const state = {
    cash: CONFIG.account.startingCash,
    startingCash: CONFIG.account.startingCash,
    currency: 'USD',
    holdings: { EH: 100 },
    positions: [],
    orders: [],
    decisions: [],
    realizedPnl: 0,
    seq: 0,
    ...overrides,
  };
  return new Portfolio(state, '/dev/null', CONFIG);
}

function amdStructure() {
  const snap = fixtureFor('AMD');
  const o = evaluateOpportunity(snap, CONFIG, { ownsShares: false });
  return selectStrategy(snap, o, CONFIG, { sharesOwned: 0 });
}

describe('risk engine', () => {
  it('sizes a fresh CSP to at least one contract within caps', () => {
    const r = assessRisk(amdStructure(), freshPortfolio(), CONFIG);
    expect(r.approved).toBe(true);
    expect(r.contracts).toBeGreaterThanOrEqual(1);
    expect(r.totalMaxLoss).toBeLessThanOrEqual(r.riskBudget + 0.01);
  });

  it('vetoes a correlated name when the sector cap is already used', () => {
    const pf = freshPortfolio({
      positions: [{ id: 'POS-1', symbol: 'MU', sector: 'semiconductors', collateral: 8000, status: 'open' }],
    });
    const r = assessRisk(amdStructure(), pf, CONFIG); // AMD is also semiconductors
    expect(r.approved).toBe(false);
    expect(r.veto).toMatch(/correlation/i);
  });

  it('vetoes when the concurrency cap is reached', () => {
    const positions = Array.from({ length: CONFIG.risk.maxConcurrentPositions }, (_, i) => ({
      id: `POS-${i}`,
      symbol: `X${i}`,
      sector: `s${i}`,
      collateral: 1000,
      status: 'open',
    }));
    const r = assessRisk(amdStructure(), freshPortfolio({ positions }), CONFIG);
    expect(r.approved).toBe(false);
    expect(r.veto).toMatch(/positions/i);
  });

  it('passes structure.type none straight through as no-trade', () => {
    const r = assessRisk({ type: 'none', symbol: 'BE', reason: 'liquidity' }, freshPortfolio(), CONFIG);
    expect(r.approved).toBe(false);
    expect(r.contracts).toBe(0);
  });
});

describe('execution engine', () => {
  it('fills a tight-market credit structure at the mid', () => {
    const structure = amdStructure();
    const order = buildLimitOrder(structure, 1, CONFIG);
    const fill = simulateFill(order, structure, CONFIG);
    expect(fill.status).toBe('filled');
    expect(fill.fillModel).toBe('mid');
    expect(fill.fillCreditTotal).toBeGreaterThan(0);
  });

  it('reconciles a matching order and position, and detects a mismatch', () => {
    const fill = { symbol: 'AMD', contracts: 1, fillCreditTotal: 654 };
    const good = { symbol: 'AMD', contracts: 1, creditReceived: 654 };
    expect(reconcile(fill, good).ok).toBe(true);
    const bad = { symbol: 'AMD', contracts: 2, creditReceived: 654 };
    const res = reconcile(fill, bad);
    expect(res.ok).toBe(false);
    expect(res.problems.join(' ')).toMatch(/mismatch/i);
  });

  it('reports a missing ledger position', () => {
    const res = reconcile({ symbol: 'AMD', contracts: 1, fillCreditTotal: 100 }, null);
    expect(res.ok).toBe(false);
  });
});

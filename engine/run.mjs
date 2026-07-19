// ─── ORCHESTRATOR ────────────────────────────────────────────────────────────
// One full cycle across the universe:
//   data -> opportunity -> risk -> strategy -> execution -> ledger -> report
// Pure with respect to its inputs: given the same provider data and the same
// starting ledger, it produces the same decisions.

import { createProvider } from './data/provider.mjs';
import { screenUniverse } from './screener.mjs';
import { evaluateOpportunity } from './opportunity.mjs';
import { selectStrategy } from './strategy.mjs';
import { assessRisk } from './risk.mjs';
import { buildLimitOrder, simulateFill, reconcile } from './execution.mjs';
import { formatRunReport, formatVerbose, deliver } from './reporter.mjs';

export async function runCycle(config, { symbols, verbose = false, notify = true, persist = true, portfolio } = {}) {
  const provider = createProvider(config);
  const baseUniverse = symbols && symbols.length ? symbols : config.universe;

  // Discovery: promote fresh candidates into the run (dormant on the mock feed).
  const screen = await screenUniverse(config, provider, { baseUniverse });
  const universe = screen.universe;

  const report = {
    asOf: provider.asOf || null,
    provider: provider.name,
    baseUniverse,
    universe,
    screener: screen,
    trades: [],
    noTrades: [],
    reconciliation: [],
    caps: {
      portfolio: config.risk.maxPortfolioNotionalPct,
      perName: config.risk.maxNotionalPerNamePct,
    },
    account: null,
  };

  const startingCash = portfolio.cash;
  let creditThisRun = 0;

  for (const symbol of universe) {
    const snapshot = await provider.fetchSnapshot(symbol);
    if (report.asOf == null) report.asOf = snapshot.asOf;
    const sharesOwned = portfolio.sharesOwned(symbol);

    // 1) Opportunity
    const opportunity = evaluateOpportunity(snapshot, config, { ownsShares: sharesOwned >= 100 });

    // 2) Strategy proposal
    const structure = selectStrategy(snapshot, opportunity, config, { sharesOwned });
    structure.asOf = snapshot.asOf;

    // 3) Risk assessment / sizing
    const risk = assessRisk(structure, portfolio, config);

    const decision = { symbol, asOf: snapshot.asOf, opportunity, structure, risk };

    if (!risk.approved) {
      decision.action = 'NO_TRADE';
      // Prefer the most specific explanation: a risk veto, else — when the
      // opportunity engine itself declined — its own gating note (earnings,
      // conviction, bias), else the structure/liquidity reason.
      const oppReason = opportunity.intent === 'none' ? opportunity.notes.join(' ') : null;
      decision.reason = risk.veto || oppReason || structure.reason || 'Did not clear the bar.';
      report.noTrades.push({ symbol, reason: decision.reason });
    } else {
      // 4) Execution (paper)
      const order = buildLimitOrder(structure, risk.contracts, config);
      const fill = simulateFill(order, structure, config);

      if (fill.status !== 'filled') {
        decision.action = 'NO_TRADE';
        decision.reason = `Order did not fill at limit ${order.limitPrice}.`;
        report.noTrades.push({ symbol, reason: decision.reason });
      } else {
        fill.id = portfolio.nextId('ORD');
        portfolio.state.orders.push(fill);
        const posId = portfolio.openPosition({ structure, contracts: risk.contracts, order: fill });
        const position = portfolio.state.positions.find((p) => p.id === posId);
        const rec = reconcile(fill, position);
        report.reconciliation.push({ symbol, ...rec });

        creditThisRun += fill.fillCreditTotal;
        decision.action = 'TRADE';
        decision.fill = fill;
        decision.positionId = posId;
        report.trades.push(decision);
      }
    }

    portfolio.recordDecision({
      asOf: snapshot.asOf,
      symbol,
      action: decision.action,
      intent: opportunity.intent,
      bias: opportunity.bias,
      conviction: opportunity.conviction,
      reason: decision.reason || (decision.structure && decision.structure.reason) || null,
      contracts: risk.contracts,
    });

    if (verbose) console.log(formatVerbose(decision));
  }

  report.account = {
    startingCash: config.account.startingCash,
    cashAfter: portfolio.cash,
    creditThisRun: round2(creditThisRun),
    committedAfter: portfolio.committedCollateral(),
    openPositions: portfolio.openPositions().length,
  };

  if (persist) portfolio.save();

  const summary = formatRunReport(report);
  let delivery = null;
  if (notify) delivery = await deliver(summary, config);

  return { report, summary, delivery };
}

const round2 = (x) => Math.round(x * 100) / 100;

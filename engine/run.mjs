// ─── ORCHESTRATOR ────────────────────────────────────────────────────────────
// One full cycle across the universe:
//   data -> opportunity -> risk -> strategy -> execution -> ledger -> report
// Pure with respect to its inputs: given the same provider data and the same
// starting ledger, it produces the same decisions.

import { readFileSync, existsSync } from 'node:fs';
import { createProvider } from './data/provider.mjs';
import { screenUniverse } from './screener.mjs';
import { evaluateOpportunity } from './opportunity.mjs';
import { selectStrategy } from './strategy.mjs';
import { assessRisk } from './risk.mjs';
import { buildLimitOrder, simulateFill, reconcile } from './execution.mjs';
import { formatRunReport, formatVerbose, deliver } from './reporter.mjs';
import { IvStore, atmIvFromSnapshot } from './ivstore.mjs';
import { decideExit } from './manage.mjs';

export async function runCycle(config, { symbols, verbose = false, notify = true, persist = true, portfolio, providerInstance } = {}) {
  // `providerInstance` lets a scenario/demo inject an evolving feed; otherwise
  // the provider is built from config (mock | live | polygon).
  const provider = providerInstance || createProvider(config);
  const baseUniverse = symbols && symbols.length ? symbols : config.universe;

  // Discovery: promote fresh candidates into the run (dormant on the mock feed).
  const screen = await screenUniverse(config, provider, { baseUniverse });
  const universe = screen.universe;

  // Overlays that refine a live provider's snapshot (never touch the mock feed):
  //  - IV-rank store: accumulates ATM IV and computes a TRUE IV rank over time.
  //  - Earnings calendar: supplies next-earnings dates the vendor may omit.
  const ivStore = config.ivStore?.enabled && provider.usesIvStore ? new IvStore(config) : null;
  const earningsCal = provider.usesEarningsOverride ? loadEarningsCalendar(config) : {};

  const report = {
    asOf: provider.asOf || null,
    provider: provider.name,
    baseUniverse,
    universe,
    screener: screen,
    exits: [],
    trades: [],
    noTrades: [],
    reconciliation: [],
    caps: {
      portfolio: config.risk.maxPortfolioNotionalPct,
      perName: config.risk.maxNotionalPerNamePct,
    },
    account: null,
  };

  // ── Manage OPEN positions first, so freed capital is available for entries ──
  if (config.management?.enabled) {
    const heldSymbols = [...new Set(portfolio.openPositions().map((p) => p.symbol))];
    const snaps = {};
    for (const s of heldSymbols) {
      try {
        snaps[s] = await provider.fetchSnapshot(s);
      } catch (err) {
        console.error(`[manage] could not price ${s}: ${err.message}`);
      }
    }
    for (const pos of portfolio.openPositions()) {
      const snap = snaps[pos.symbol];
      if (!snap) continue;
      const exit = decideExit(pos, snap, config);
      if (exit.action === 'hold') continue;
      portfolio.applyExit(pos, exit); // closes/settles the existing position
      const rec = { symbol: pos.symbol, type: pos.type, contracts: pos.contracts, ...exit };

      // A roll also OPENS the further-dated replacement via the normal fill path.
      if (exit.action === 'roll' && exit.newStructure) {
        const order = buildLimitOrder(exit.newStructure, pos.contracts, config);
        const fill = simulateFill(order, exit.newStructure, config);
        if (fill.status === 'filled') {
          fill.id = portfolio.nextId('ORD');
          portfolio.state.orders.push(fill);
          const posId = portfolio.openPosition({ structure: exit.newStructure, contracts: pos.contracts, order: fill });
          rec.rolledToId = posId;
          const rolled = portfolio.state.positions.find((p) => p.id === posId);
          report.reconciliation.push({ symbol: pos.symbol, ...reconcile(fill, rolled) });
        } else {
          rec.rollFilled = false;
        }
      }
      report.exits.push(rec);
    }
  }

  const startingCash = portfolio.cash;
  let creditThisRun = 0;

  for (const symbol of universe) {
    const snapshot = await provider.fetchSnapshot(symbol);
    if (report.asOf == null) report.asOf = snapshot.asOf;

    // Apply overlays before any analysis sees the snapshot.
    if (ivStore) {
      const atm = atmIvFromSnapshot(snapshot);
      ivStore.record(symbol, snapshot.asOf, atm);
      const r = ivStore.rank(symbol, atm);
      if (r.status === 'ok') {
        snapshot.ivRank = r.rank;
        snapshot.ivRankSource = `iv-store (${r.samples} samples)`;
      } else {
        snapshot.ivRankSource = `realized-vol proxy (IV history warming up: ${r.samples}/${config.ivStore.minSamples})`;
      }
    }
    if (earningsCal[symbol]) snapshot.earnings = { nextDate: earningsCal[symbol] };

    const sharesOwned = portfolio.sharesOwned(symbol);

    // 1) Opportunity
    const opportunity = evaluateOpportunity(snapshot, config, { ownsShares: sharesOwned >= 100 });

    // 2) Strategy proposal
    const structure = selectStrategy(snapshot, opportunity, config, { sharesOwned });
    structure.asOf = snapshot.asOf;

    // 3) Risk assessment / sizing
    const risk = assessRisk(structure, portfolio, config);

    const decision = { symbol, asOf: snapshot.asOf, opportunity, structure, risk, ivRankSource: snapshot.ivRankSource || null };

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
    realizedPnl: round2(portfolio.state.realizedPnl || 0),
  };

  if (persist) {
    portfolio.save();
    if (ivStore) ivStore.save(); // accumulate IV history for future true IV ranks
  }

  const summary = formatRunReport(report);
  let delivery = null;
  if (notify) delivery = await deliver(summary, config);

  return { report, summary, delivery };
}

// Load an optional { SYMBOL: 'YYYY-MM-DD' } earnings-date map from disk.
function loadEarningsCalendar(config) {
  const path = config.earningsCalendarPath;
  if (!path || !existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

const round2 = (x) => Math.round(x * 100) / 100;

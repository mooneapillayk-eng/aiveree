#!/usr/bin/env node
// ─── LIFECYCLE DEMO ──────────────────────────────────────────────────────────
// Drives the REAL engine (opportunity -> risk -> strategy -> execution ->
// management -> roll) across a scripted timeline for a single name, so you can
// watch one position go analysis -> entry -> hold -> roll -> exit run by run.
//
// Nothing here fakes the decisions: each "day" builds a realistic snapshot
// (evolving price / IV / option chain) and calls runCycle() with the same
// persistent in-memory portfolio. Only the market data is scripted.
//
//   node engine/demo-lifecycle.mjs
//
// Output is deterministic. Numbers are illustrative, mechanics are real.

import { CONFIG } from './config.mjs';
import { Portfolio } from './portfolio.mjs';
import { runCycle } from './run.mjs';
import { decideExit } from './manage.mjs';
import { bsPrice } from './backfill-iv.mjs';
import { bsDelta } from './data/liveProvider.mjs';

const SYMBOL = 'MU';
const RATE = 0.04;
const round2 = (x) => Math.round(x * 100) / 100;
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86_400_000);

// A gentle year-long uptrend so the technical lens reads "above 200DMA, golden
// cross, pullback to the 50DMA". Fixed across days (only price/chain/IV evolve).
function buildHistory() {
  const bars = [];
  for (let i = 0; i < 220; i++) bars.push({ date: '2026-01-01', close: round2(78 + (i / 219) * 16), volume: 25_000_000 });
  return bars;
}
const HISTORY = buildHistory();

// Weekly + monthly expiries (every Friday) out to ~60 days, with a BS-priced
// chain around spot at the given IV — real deltas, real premiums.
function buildChain(spot, asOf, iv) {
  const expirations = [];
  const start = new Date(asOf + 'T00:00:00Z');
  for (let d = 8; d <= 60; d++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + d);
    if (day.getUTCDay() !== 5) continue; // Fridays only
    const expiry = day.toISOString().slice(0, 10);
    const dte = d;
    const step = 2.5;
    const strikes = [];
    for (let k = Math.round((spot * 0.75) / step) * step; k <= spot * 1.25; k += step) strikes.push(round2(k));
    const mk = (strike, right) => {
      const T = dte / 365;
      const mid = Math.max(0.02, bsPrice({ spot, strike, T, r: RATE, sigma: iv, right }));
      const spread = Math.max(0.02, mid * 0.03);
      return {
        strike,
        bid: round2(mid - spread / 2),
        ask: round2(mid + spread / 2),
        iv: round2(iv),
        openInterest: 1500,
        volume: 250,
        delta: round2(bsDelta({ spot, strike, dte, iv, right, riskFreeRate: RATE })),
      };
    };
    expirations.push({ expiry, dte, calls: strikes.map((s) => mk(s, 'call')), puts: strikes.map((s) => mk(s, 'put')) });
  }
  return { asOf, expirations };
}

export function snapshotFor(day) {
  return {
    symbol: SYMBOL,
    asOf: day.date,
    price: day.spot,
    prevClose: day.spot,
    volume: 30_000_000,
    avgVolume: 28_000_000,
    history: HISTORY,
    fundamentals: { priceToSales: 3.1, forwardPe: 12, revenueGrowthYoY: 0.30, grossMargin: 0.35, cashPerShare: 7.1, debtToEquity: 0.28, marketCap: 130e9 },
    shortInterest: { percentFloat: 0.09, daysToCover: 3.1 },
    earnings: { nextDate: '2026-10-29' },
    ivRank: day.ivRank,
    optionChain: buildChain(day.spot, day.date, day.iv),
  };
}

class ScriptedProvider {
  constructor(day) {
    this.name = 'scripted';
    this.asOf = day.date;
    this.supportsDiscovery = false;
    this._day = day;
  }
  async fetchSnapshot() {
    return snapshotFor(this._day);
  }
}

// The scripted tape: entry -> holds -> roll at the DTE cutoff -> holds -> exit.
const TIMELINE = [
  { date: '2026-08-14', spot: 92.4, iv: 0.46, ivRank: 46, note: 'Analysis: bullish pullback + rich IV -> open a cash-secured put' },
  { date: '2026-08-21', spot: 90.6, iv: 0.45, ivRank: 44, note: 'Marked & held (profit target not hit, ~28 DTE)' },
  { date: '2026-08-25', spot: 91.8, iv: 0.43, ivRank: 43, note: 'Theta working; still held (~24 DTE)' },
  { date: '2026-08-28', spot: 91.5, iv: 0.42, ivRank: 42, note: 'Short leg reaches the 21-DTE cutoff -> roll out for a credit' },
  { date: '2026-09-08', spot: 91.5, iv: 0.42, ivRank: 40, note: 'Rolled leg marked & held (recovering, target not yet hit)' },
  { date: '2026-09-18', spot: 97.0, iv: 0.33, ivRank: 26, note: 'Rally + IV crush -> 50% profit target -> close (IV now too low to re-enter)' },
];

function fmt(x) {
  return Number(x || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

async function main() {
  const cfg = structuredClone(CONFIG);
  cfg.statePath = '/dev/null';
  cfg.telegram = { botToken: null, chatId: null };
  const portfolio = new Portfolio(
    { cash: cfg.account.startingCash, startingCash: cfg.account.startingCash, currency: 'USD', holdings: {}, positions: [], orders: [], decisions: [], realizedPnl: 0, seq: 0 },
    '/dev/null',
    cfg
  );

  console.log('════════════════════════════════════════════════════════════════');
  console.log(` LIFECYCLE DEMO — ${SYMBOL} — account $${fmt(cfg.account.startingCash)} (paper)`);
  console.log('════════════════════════════════════════════════════════════════');

  for (let i = 0; i < TIMELINE.length; i++) {
    const day = TIMELINE[i];
    const provider = new ScriptedProvider(day);

    // Capture the open position (if any) BEFORE the run, to describe a HOLD.
    const before = portfolio.openPositions()[0];
    const beforeSnap = before ? snapshotFor(day) : null;

    const { report } = await runCycle(cfg, { symbols: [SYMBOL], portfolio, providerInstance: provider, notify: false, persist: false });

    console.log(`\n─ Day ${i} · ${day.date} · ${SYMBOL} $${day.spot} · IVrank ${day.ivRank} ─────────────`);
    console.log(`  ${day.note}`);

    // Entries
    for (const t of report.trades) {
      const s = t.structure;
      console.log(`  ENTRY  ${labelType(s.type)} [${t.risk.contracts}x] ${s.reason}`);
      console.log(`         credit $${fmt(t.fill.fillCreditTotal)} · max loss $${fmt(t.risk.totalMaxLoss)} · collateral $${fmt(t.risk.totalCollateral)} · breakeven ${s.breakeven}`);
    }
    // Exits / rolls
    for (const e of report.exits) {
      const tag = e.status.toUpperCase();
      console.log(`  ${tag}${e.action === 'roll' ? ' ' : '  '}${labelType(e.type)} [${e.contracts}x] — ${e.reason} · P&L ${e.pnl >= 0 ? '+' : ''}$${fmt(e.pnl)}`);
    }
    // Hold (open position that took no action this run)
    if (!report.trades.length && !report.exits.length && before && beforeSnap) {
      const d = decideExit(before, beforeSnap, cfg);
      if (d.action === 'hold') {
        const capture = before.creditReceived ? ((before.creditReceived - d.mark.costToClose) / before.creditReceived) * 100 : 0;
        console.log(`  HOLD   ${labelType(before.type)} [${before.contracts}x] ${before.expiry} · mark $${fmt(d.mark.costToClose)} · captured ${capture.toFixed(0)}% · ${d.mark.dte}d to expiry`);
      }
    }
    // No-trade explanation (only interesting when flat)
    if (!report.trades.length && !report.exits.length && !before) {
      const nt = report.noTrades.find((n) => n.symbol === SYMBOL);
      if (nt) console.log(`  NO TRADE — ${nt.reason}`);
    }

    console.log(`  ► cash $${fmt(portfolio.cash)} · open ${portfolio.openPositions().length} · committed $${fmt(portfolio.committedCollateral())} · realized P&L ${portfolio.state.realizedPnl >= 0 ? '+' : ''}$${fmt(portfolio.state.realizedPnl)}`);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(` RESULT — realized P&L +$${fmt(portfolio.state.realizedPnl)} · cash $${fmt(portfolio.cash)} · open positions ${portfolio.openPositions().length}`);
  console.log('════════════════════════════════════════════════════════════════');
}

function labelType(t) {
  return { cash_secured_put: 'Cash-Secured Put', put_spread: 'Put Credit Spread', covered_call: 'Covered Call' }[t] || t;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('Demo failed:', err);
    process.exit(1);
  });
}

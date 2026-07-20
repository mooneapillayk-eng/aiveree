// ─── POSITION MANAGEMENT (EXITS) ─────────────────────────────────────────────
// Decides what to do with each OPEN position, before the engine looks for new
// entries. Short premium is marked to a Black-Scholes model value (spot + IV +
// time), then:
//   • profit target  — buy-to-close once a set fraction of the credit is captured
//   • stop loss       — close once the loss reaches N x the credit
//   • DTE exit        — close near expiry to avoid late-cycle gamma
//   • expiration      — settle intrinsics, including assignment (CSP -> shares put
//                       to you) and shares called away (covered call)
// The math is pure and unit-tested; the orchestrator applies the result to the
// ledger via portfolio.applyExit().

import { bsPrice } from './backfill-iv.mjs';
import { atmIvFromSnapshot } from './ivstore.mjs';

// Mark a position to model value. Returns the net debit to close (costToClose),
// the mark P&L (credit already received minus that debit), and days to expiry.
export function markPosition(position, { spot, iv, asOf, riskFreeRate }) {
  const dte = daysBetween(asOf, position.expiry);
  const T = Math.max(dte, 0) / 365;
  let perContract = 0; // net debit per contract to buy the structure back
  for (const leg of position.legs) {
    const legIv = iv ?? leg.iv ?? 0.4;
    const mark = T > 0
      ? bsPrice({ spot, strike: leg.strike, T, r: riskFreeRate, sigma: legIv, right: leg.right })
      : intrinsic(leg.right, spot, leg.strike);
    // Closing reverses the open: a sold leg is bought back (debit), a bought leg
    // is sold (credit).
    perContract += leg.side === 'sell' ? mark : -mark;
  }
  const costToClose = round2(perContract * 100 * position.contracts);
  return { dte, costToClose, markPnl: round2(position.creditReceived - costToClose) };
}

// Decide the exit action from a mark. Returns { action: 'hold' } or a full exit
// object ready for portfolio.applyExit().
export function decideExit(position, snapshot, config) {
  const spot = snapshot.price;
  const iv = atmIvFromSnapshot(snapshot);
  const asOf = snapshot.asOf;
  const m = config.management;
  const mark = markPosition(position, { spot, iv, asOf, riskFreeRate: m.riskFreeRate });

  // At/after expiration -> settle intrinsics (may assign shares).
  if (mark.dte <= 0) {
    return { action: 'settle', ...settleAtExpiration(position, spot, asOf) };
  }

  const credit = position.creditReceived || 0;
  const capturePct = credit > 0 ? mark.markPnl / credit : 0;
  const lossMultiple = credit > 0 ? -mark.markPnl / credit : 0;

  if (capturePct >= m.profitTargetPct) {
    return closeEarly(position, mark, asOf, `profit target ${(m.profitTargetPct * 100).toFixed(0)}% (captured ${(capturePct * 100).toFixed(0)}%)`);
  }
  if (lossMultiple >= m.stopLossMultiple) {
    return closeEarly(position, mark, asOf, `stop loss ${m.stopLossMultiple}x credit`);
  }
  if (mark.dte <= m.dteExit) {
    return closeEarly(position, mark, asOf, `DTE exit (${mark.dte}d <= ${m.dteExit}d)`);
  }
  return { action: 'hold', mark };
}

function closeEarly(position, mark, asOf, reason) {
  return {
    action: 'close',
    status: 'closed',
    reason,
    asOf,
    cashDelta: -mark.costToClose, // pay the debit to buy it back
    sharesDelta: 0,
    pnl: mark.markPnl, // credit - costToClose
    mark: mark.costToClose,
  };
}

// Cash/settlement at expiration by structure. Credit was already banked at open;
// here we settle intrinsic value and any share assignment.
export function settleAtExpiration(position, spot, asOf) {
  const n = position.contracts;
  const credit = position.creditReceived || 0;
  const shortLeg = position.legs.find((l) => l.side === 'sell');
  const longLeg = position.legs.find((l) => l.side === 'buy');
  const k = shortLeg.strike;

  if (position.type === 'cash_secured_put') {
    if (spot < k) {
      // Assigned: buy 100 shares/contract at the strike.
      return { status: 'assigned', reason: `assigned: put ITM (spot ${round2(spot)} < ${k})`, asOf, cashDelta: -k * 100 * n, sharesDelta: 100 * n, pnl: credit };
    }
    return { status: 'expired', reason: `expired worthless (spot ${round2(spot)} >= ${k})`, asOf, cashDelta: 0, sharesDelta: 0, pnl: credit };
  }

  if (position.type === 'covered_call') {
    if (spot > k) {
      // Shares called away at the strike.
      return { status: 'assigned', reason: `called away: call ITM (spot ${round2(spot)} > ${k})`, asOf, cashDelta: k * 100 * n, sharesDelta: -100 * n, pnl: credit };
    }
    return { status: 'expired', reason: `call expired worthless (spot ${round2(spot)} <= ${k})`, asOf, cashDelta: 0, sharesDelta: 0, pnl: credit };
  }

  if (position.type === 'put_spread') {
    const shortIntr = Math.max(0, shortLeg.strike - spot);
    const longIntr = longLeg ? Math.max(0, longLeg.strike - spot) : 0;
    const netLoss = round2((shortIntr - longIntr) * 100 * n); // bounded by width
    return { status: 'expired', reason: `spread settled (net intrinsic ${round2(shortIntr - longIntr)})`, asOf, cashDelta: -netLoss, sharesDelta: 0, pnl: round2(credit - netLoss) };
  }

  // Unknown structure: no-op settle.
  return { status: 'expired', reason: 'expired', asOf, cashDelta: 0, sharesDelta: 0, pnl: credit };
}

function intrinsic(right, spot, strike) {
  return right === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}
function daysBetween(aISO, bISO) {
  return Math.round((new Date(bISO + 'T00:00:00Z') - new Date(aISO + 'T00:00:00Z')) / 86_400_000);
}
const round2 = (x) => Math.round(x * 100) / 100;

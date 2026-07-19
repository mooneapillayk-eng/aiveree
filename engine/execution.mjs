// ─── EXECUTION ENGINE (PAPER) ────────────────────────────────────────────────
// Simulates order placement and fills. No broker connectivity — fills are
// modelled deterministically from the quoted chain so a paper run is fully
// reproducible. Includes a reconciliation step that checks what we intended to
// trade against what the ledger recorded.

export function buildLimitOrder(structure, contracts, config) {
  // A credit structure: we place a limit at (or improved toward) the mid.
  const legs = structure.legs.map((l) => ({
    action: l.side === 'sell' ? 'sell_to_open' : 'buy_to_open',
    right: l.right,
    strike: l.strike,
    quantity: contracts,
    quotedBid: l.bid,
    quotedAsk: l.ask,
    quotedMid: l.price,
  }));
  const limitCredit = round2((structure.creditPerShare || 0) * config.execution.limitAtPctOfMid);
  return {
    symbol: structure.symbol,
    type: structure.type,
    expiry: structure.expiry,
    contracts,
    orderType: 'limit',
    side: 'net_credit',
    limitPrice: limitCredit, // per share, net credit sought
    legs,
    status: 'pending',
  };
}

// Deterministic fill model. A seller's limit at mid fills at mid when the market
// is tight; when the spread is wide we assume the conservative fill (the bid /
// long leg at the ask), i.e. a worse net credit.
export function simulateFill(order, structure, config) {
  const tight = structureSpreadPct(structure) <= config.execution.midFillMaxSpreadPct;
  let fillCreditPerShare;
  if (tight) {
    fillCreditPerShare = structure.creditPerShare;
  } else {
    // Worst-case marketable credit: sell legs at bid, buy legs at ask.
    fillCreditPerShare = round2(
      structure.legs.reduce((acc, l) => {
        return acc + (l.side === 'sell' ? l.bid : -l.ask);
      }, 0)
    );
  }
  const filled = fillCreditPerShare >= order.limitPrice - 0.001 || !tight;
  return {
    ...order,
    id: null, // assigned by the runner when it commits the order
    status: filled ? 'filled' : 'unfilled',
    fillModel: tight ? 'mid' : 'conservative',
    fillCreditPerShare,
    fillCreditTotal: round2(fillCreditPerShare * 100 * order.contracts),
    filledAsOf: structure.asOf || null,
  };
}

// Reconciliation: assert the ledger position matches the filled order.
export function reconcile(order, position) {
  const problems = [];
  if (!position) {
    problems.push('No ledger position was created for a filled order.');
    return { ok: false, problems };
  }
  if (position.contracts !== order.contracts) {
    problems.push(`Contract mismatch: order ${order.contracts} vs ledger ${position.contracts}.`);
  }
  if (position.symbol !== order.symbol) {
    problems.push(`Symbol mismatch: order ${order.symbol} vs ledger ${position.symbol}.`);
  }
  const expected = round2(order.fillCreditTotal);
  if (Math.abs((position.creditReceived || 0) - expected) > 0.01) {
    problems.push(`Credit mismatch: order ${expected} vs ledger ${position.creditReceived}.`);
  }
  return { ok: problems.length === 0, problems };
}

function structureSpreadPct(structure) {
  // Widest per-leg relative spread across the structure.
  let worst = 0;
  for (const l of structure.legs) {
    const m = l.price || (l.bid + l.ask) / 2;
    if (m > 0) worst = Math.max(worst, (l.ask - l.bid) / m);
  }
  return worst;
}

const round2 = (x) => Math.round(x * 100) / 100;

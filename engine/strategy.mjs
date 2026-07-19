// ─── STRATEGY SELECTOR ───────────────────────────────────────────────────────
// Turns an opportunity intent into a concrete option structure with strikes,
// expiry and per-contract economics. Chooses between:
//   cash_secured_put | put_spread | covered_call | none
// Sizing (number of contracts) and portfolio-level vetoes belong to the risk
// engine — this module only proposes ONE well-formed structure per symbol.

import { mid } from './data/provider.mjs';

export function selectStrategy(snapshot, opportunity, config, { sharesOwned = 0 } = {}) {
  if (!opportunity.tradable || opportunity.intent === 'none') {
    return { type: 'none', symbol: snapshot.symbol, reason: 'No tradable intent from opportunity engine.' };
  }

  const exp = pickExpiration(snapshot, config);
  if (!exp) {
    return { type: 'none', symbol: snapshot.symbol, reason: `No expiration in ${config.opportunity.dteMin}-${config.opportunity.dteMax} DTE window.` };
  }

  if (opportunity.intent === 'covered_call') {
    return buildCoveredCall(snapshot, exp, config, sharesOwned);
  }

  // intent === 'sell_put' -> prefer a cash-secured put; fall back to a
  // defined-risk put spread when the CSP can't be afforded within caps.
  const csp = buildCashSecuredPut(snapshot, exp, config);
  if (csp.type === 'none') return csp;

  const perNameCap = config.account.startingCash * config.risk.maxNotionalPerNamePct;
  const affordCsp = csp.collateralPerContract <= perNameCap;
  if (affordCsp) return csp;

  const spread = buildPutSpread(snapshot, exp, config);
  if (spread.type !== 'none') {
    spread.note = 'CSP collateral exceeds per-name cap — using defined-risk put spread.';
    return spread;
  }
  // Neither structure is viable.
  return { type: 'none', symbol: snapshot.symbol, reason: 'CSP too large for caps and no viable put spread.' };
}

// ── Structure builders ────────────────────────────────────────────────────────

function buildCashSecuredPut(snapshot, exp, config) {
  const target = config.opportunity.targetDeltaShort;
  const shortPut = pickPutByDelta(exp, target, config);
  if (!shortPut) {
    return { type: 'none', symbol: snapshot.symbol, reason: 'No liquid ~30-delta put found (liquidity).' };
  }
  const credit = round2(mid(shortPut));
  const strike = shortPut.strike;
  const collateralPerContract = strike * 100;
  const stopLoss = config.risk.cspStopLossMultiple * credit;
  return {
    type: 'cash_secured_put',
    symbol: snapshot.symbol,
    expiry: exp.expiry,
    dte: exp.dte,
    legs: [legView('sell', 'put', shortPut)],
    creditPerContract: round2(credit * 100),
    creditPerShare: credit,
    collateralPerContract,
    // Risk budgeted to a mechanical stop, not stock-to-zero (see config).
    maxLossPerContract: round2(stopLoss * 100),
    breakeven: round2(strike - credit),
    shortDelta: shortPut.delta,
    reason: `Sell ${snapshot.symbol} ${exp.expiry} ${strike}P @ ${credit} (${Math.abs(Math.round(shortPut.delta * 100))}Δ), stop at ${config.risk.cspStopLossMultiple}x credit.`,
  };
}

function buildPutSpread(snapshot, exp, config) {
  const target = config.opportunity.targetDeltaShort;
  const shortPut = pickPutByDelta(exp, target, config);
  if (!shortPut) return { type: 'none', symbol: snapshot.symbol, reason: 'No liquid short put (liquidity).' };
  const longStrike = shortPut.strike - config.opportunity.putSpreadWidth;
  const longPut = exp.puts.find((p) => p.strike === longStrike) || nearestStrike(exp.puts, longStrike);
  if (!longPut || !isLiquid(longPut, config)) {
    return { type: 'none', symbol: snapshot.symbol, reason: 'No liquid long put to define risk (liquidity).' };
  }
  const width = round2(shortPut.strike - longPut.strike);
  const credit = round2(mid(shortPut) - mid(longPut));
  if (credit <= 0) return { type: 'none', symbol: snapshot.symbol, reason: 'Put spread would be a net debit.' };
  const ratio = credit / width;
  if (ratio < config.risk.minCreditToWidthRatio) {
    return { type: 'none', symbol: snapshot.symbol, reason: `Credit/width ${ratio.toFixed(2)} below ${config.risk.minCreditToWidthRatio}.` };
  }
  const maxLoss = round2((width - credit) * 100);
  return {
    type: 'put_spread',
    symbol: snapshot.symbol,
    expiry: exp.expiry,
    dte: exp.dte,
    legs: [legView('sell', 'put', shortPut), legView('buy', 'put', longPut)],
    creditPerContract: round2(credit * 100),
    creditPerShare: credit,
    width,
    collateralPerContract: round2(width * 100),
    maxLossPerContract: maxLoss,
    breakeven: round2(shortPut.strike - credit),
    shortDelta: shortPut.delta,
    reason: `Sell ${snapshot.symbol} ${exp.expiry} ${shortPut.strike}/${longPut.strike} put spread @ ${credit} credit (width ${width}).`,
  };
}

function buildCoveredCall(snapshot, exp, config, sharesOwned) {
  if (sharesOwned < 100) {
    return { type: 'none', symbol: snapshot.symbol, reason: `Only ${sharesOwned} shares — need 100 to cover a call.` };
  }
  const shortCall = pickCallByDelta(exp, config.opportunity.targetDeltaShort, config);
  if (!shortCall) return { type: 'none', symbol: snapshot.symbol, reason: 'No liquid ~30-delta call found (liquidity).' };
  const credit = round2(mid(shortCall));
  return {
    type: 'covered_call',
    symbol: snapshot.symbol,
    expiry: exp.expiry,
    dte: exp.dte,
    legs: [legView('sell', 'call', shortCall)],
    creditPerContract: round2(credit * 100),
    creditPerShare: credit,
    // Covered by stock already held: no new cash collateral, capped upside.
    collateralPerContract: 0,
    coveredByShares: 100,
    maxContractsFromShares: Math.floor(sharesOwned / 100),
    // The option itself only caps upside; "risk" here is the stock's, already held.
    maxLossPerContract: 0,
    breakeven: round2(snapshot.price - credit),
    shortDelta: shortCall.delta,
    reason: `Sell ${snapshot.symbol} ${exp.expiry} ${shortCall.strike}C @ ${credit} against ${sharesOwned} shares.`,
  };
}

// ── Selection helpers ─────────────────────────────────────────────────────────

export function pickExpiration(snapshot, config) {
  const exps = (snapshot.optionChain?.expirations || []).filter(
    (e) => e.dte >= config.opportunity.dteMin && e.dte <= config.opportunity.dteMax
  );
  if (!exps.length) return null;
  const targetDte = (config.opportunity.dteMin + config.opportunity.dteMax) / 2;
  return exps.slice().sort((a, b) => Math.abs(a.dte - targetDte) - Math.abs(b.dte - targetDte))[0];
}

export function pickPutByDelta(exp, targetAbsDelta, config) {
  return pickByDelta(exp.puts, targetAbsDelta, config);
}
export function pickCallByDelta(exp, targetAbsDelta, config) {
  return pickByDelta(exp.calls, targetAbsDelta, config);
}

// Choose the liquid option whose |delta| is closest to the target.
function pickByDelta(legs, targetAbsDelta, config) {
  const liquid = legs.filter((o) => isLiquid(o, config));
  if (!liquid.length) return null;
  return liquid
    .slice()
    .sort((a, b) => Math.abs(Math.abs(a.delta) - targetAbsDelta) - Math.abs(Math.abs(b.delta) - targetAbsDelta))[0];
}

export function isLiquid(opt, config) {
  const l = config.liquidity;
  if ((opt.openInterest || 0) < l.minOpenInterest) return false;
  if ((opt.volume || 0) < l.minContractVolume) return false;
  const m = mid(opt);
  if (m <= 0) return false;
  const spreadPct = (opt.ask - opt.bid) / m;
  return spreadPct <= l.maxBidAskSpreadPct;
}

function nearestStrike(legs, strike) {
  return legs.slice().sort((a, b) => Math.abs(a.strike - strike) - Math.abs(b.strike - strike))[0];
}

function legView(side, right, opt) {
  return {
    side,
    right,
    strike: opt.strike,
    price: round2(mid(opt)),
    bid: opt.bid,
    ask: opt.ask,
    delta: opt.delta,
    openInterest: opt.openInterest,
    volume: opt.volume,
    iv: opt.iv,
  };
}

const round2 = (x) => Math.round(x * 100) / 100;

// ─── OPPORTUNITY ENGINE ──────────────────────────────────────────────────────
// Combines valuation + technical + positioning into a single view: a directional
// bias, a conviction score, and a proposed *intent* (what kind of trade, if any,
// the setup argues for). It does NOT size or select strikes — that is the risk
// engine and strategy selector. It CAN reject outright on event risk.

import { analyzeValuation } from './analysis/valuation.mjs';
import { analyzeTechnical } from './analysis/technical.mjs';
import { analyzePositioning } from './analysis/positioning.mjs';

// Weights sum to 1. Valuation and technical drive direction; positioning gates
// whether options are worth selling.
const WEIGHTS = { valuation: 0.35, technical: 0.4, positioning: 0.25 };

export function evaluateOpportunity(snapshot, config, { ownsShares = false } = {}) {
  const valuation = analyzeValuation(snapshot, config);
  const technical = analyzeTechnical(snapshot, config);
  const positioning = analyzePositioning(snapshot, config);

  const composite = Math.round(
    valuation.score * WEIGHTS.valuation +
      technical.score * WEIGHTS.technical +
      positioning.score * WEIGHTS.positioning
  );

  // Directional bias from valuation + technical (positioning is a premium gate).
  const dirScore = Math.round((valuation.score + technical.score) / 2);
  const bias = dirScore >= 20 ? 'bullish' : dirScore <= -20 ? 'bearish' : 'neutral';

  // Conviction is the magnitude of the composite, floored at 0.
  const conviction = Math.max(0, composite);

  const notes = [];
  let intent = 'none';
  let tradable = true;

  // ── Hard event gate: no new premium sale into an earnings print ─────────────
  const daysToEarnings = daysUntil(snapshot.earnings?.nextDate, snapshot.asOf);
  if (daysToEarnings != null && daysToEarnings <= config.opportunity.earningsBlackoutDays && daysToEarnings >= 0) {
    tradable = false;
    notes.push(`Earnings in ${daysToEarnings}d (<= ${config.opportunity.earningsBlackoutDays}d blackout) — event risk, stand aside.`);
  }

  // ── IV gate: premium selling needs elevated IV ──────────────────────────────
  const ivOk = (snapshot.ivRank ?? 0) >= config.opportunity.minIvRank;
  if (!ivOk) {
    notes.push(`IV rank ${snapshot.ivRank} below ${config.opportunity.minIvRank} — premium too thin.`);
  }

  // ── Intent selection (transparent, boring rules) ────────────────────────────
  const nearHighs = (technical.fib?.positionInRange ?? 0) >= 0.85;
  if (tradable) {
    if (ownsShares && ivOk && (valuation.label === 'expensive' || nearHighs)) {
      // We hold stock in a name that is richly valued or extended near its highs
      // -> harvest premium and set a disciplined exit via a covered call.
      intent = 'covered_call';
      notes.push('Own shares in a rich / extended name — covered call to harvest premium and set an exit.');
    } else if (ivOk && bias !== 'bearish' && conviction >= config.opportunity.minConviction) {
      // Bullish-to-neutral, not expensive, good premium -> sell downside.
      intent = 'sell_put'; // strategy selector picks CSP vs defined-risk spread
      notes.push('Bullish/neutral with elevated IV — sell downside premium.');
    } else {
      intent = 'none';
      if (bias === 'bearish') notes.push('Directional read is bearish — no premium sale.');
      else if (conviction < config.opportunity.minConviction)
        notes.push(`Conviction ${conviction} below ${config.opportunity.minConviction} — not compelling.`);
    }
  }

  return {
    symbol: snapshot.symbol,
    composite,
    conviction,
    bias,
    intent,
    tradable: tradable && intent !== 'none',
    daysToEarnings,
    ivOk,
    lenses: { valuation, technical, positioning },
    notes,
  };
}

export function daysUntil(dateStr, asOfStr) {
  if (!dateStr) return null;
  const a = new Date(dateStr + 'T00:00:00Z').getTime();
  const b = new Date((asOfStr || dateStr) + 'T00:00:00Z').getTime();
  return Math.round((a - b) / 86_400_000);
}

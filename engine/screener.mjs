// ─── SCREENER (CANDIDATE DISCOVERY) ──────────────────────────────────────────
// Sources NEW candidate symbols beyond the fixed universe and promotes the best
// into the run. It deliberately reuses the SAME opportunity lenses used to trade,
// so a name is only promoted for the same reasons it would later be traded:
// elevated IV rank, supportive short interest / positioning, reasonable value,
// constructive technicals — and never inside an earnings blackout.
//
// DORMANT BY DESIGN: discovering fresh tickers requires scanning a broad market
// list, which only a live data feed can provide. The mock provider does not
// support discovery, so in mock mode this returns the base universe unchanged.
// A live provider opts in by exposing:
//     provider.supportsDiscovery === true
//     provider.listCandidates() -> Promise<string[]>   // tickers to screen
// and the existing fetchSnapshot(symbol) for each.

import { evaluateOpportunity } from './opportunity.mjs';

export async function screenUniverse(config, provider, { baseUniverse }) {
  const base = dedupe(baseUniverse);

  if (!config.screener?.enabled) {
    return { dormant: true, reason: 'Screener disabled in config.', universe: base, promoted: [] };
  }
  if (!provider.supportsDiscovery || typeof provider.listCandidates !== 'function') {
    return {
      dormant: true,
      reason: `Provider '${provider.name}' has no discovery feed — analysing the explicit universe only.`,
      universe: base,
      promoted: [],
    };
  }

  // Live path: score every candidate that isn't already in the universe.
  const baseSet = new Set(base);
  const candidates = dedupe(await provider.listCandidates()).filter((s) => !baseSet.has(s));

  const scored = [];
  for (const symbol of candidates) {
    let snapshot;
    try {
      snapshot = await provider.fetchSnapshot(symbol);
    } catch {
      continue; // a candidate we can't price is simply skipped
    }
    const screen = scoreCandidate(snapshot, config);
    if (screen.eligible) scored.push(screen);
  }

  scored.sort((a, b) => b.score - a.score);
  const promoted = scored.slice(0, config.screener.maxNewCandidates);

  return {
    dormant: false,
    reason: null,
    universe: dedupe([...base, ...promoted.map((p) => p.symbol)]),
    considered: candidates.length,
    promoted,
  };
}

// Pure ranking of one candidate using the trading lenses. A name is eligible
// only if it is not in an earnings blackout, has tradable premium (IV floor),
// and clears the composite score floor.
export function scoreCandidate(snapshot, config) {
  const opp = evaluateOpportunity(snapshot, config, { ownsShares: false });
  const inBlackout =
    opp.daysToEarnings != null &&
    opp.daysToEarnings >= 0 &&
    opp.daysToEarnings <= config.opportunity.earningsBlackoutDays;
  const eligible = !inBlackout && opp.ivOk && opp.composite >= config.screener.minScreenScore;
  return {
    symbol: snapshot.symbol,
    score: opp.composite,
    conviction: opp.conviction,
    bias: opp.bias,
    ivRank: snapshot.ivRank,
    shortInterestPctFloat: snapshot.shortInterest?.percentFloat ?? null,
    eligible,
    reasons: [
      `composite ${opp.composite}`,
      `IVrank ${snapshot.ivRank}`,
      snapshot.shortInterest?.percentFloat != null
        ? `short ${(snapshot.shortInterest.percentFloat * 100).toFixed(1)}% float`
        : null,
      inBlackout ? `earnings in ${opp.daysToEarnings}d` : null,
      !opp.ivOk ? 'IV too low' : null,
    ].filter(Boolean),
  };
}

function dedupe(list) {
  return Array.from(new Set(list || []));
}

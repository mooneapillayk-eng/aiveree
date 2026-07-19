// ─── MARKET POSITIONING LENS ─────────────────────────────────────────────────
// What the crowd is doing: short interest, put/call open interest, and implied
// volatility. For a premium-selling engine, elevated IV is opportunity (richer
// premium) and heavy short interest hints at squeeze/limited-downside dynamics.
// Score is -100 .. +100 where positive = supportive of selling puts.

export function analyzePositioning(snapshot, config) {
  const si = snapshot.shortInterest || {};
  const reasons = [];
  let score = 0;

  // Short interest: moderate-to-high short float can put a floor under a name
  // (squeeze risk to the downside for shorts). Extreme short interest is a
  // yellow flag though — the crowd may know something.
  if (typeof si.percentFloat === 'number') {
    if (si.percentFloat >= 0.20) {
      score -= 10;
      reasons.push(`Very high short interest (${pct(si.percentFloat)} of float) — caution.`);
    } else if (si.percentFloat >= 0.08) {
      score += 15;
      reasons.push(`Elevated short interest (${pct(si.percentFloat)} of float) — squeeze potential supports downside.`);
    } else {
      reasons.push(`Short interest modest (${pct(si.percentFloat)} of float).`);
    }
  }
  if (typeof si.daysToCover === 'number' && si.daysToCover >= 3) {
    score += 5;
    reasons.push(`Days-to-cover ${si.daysToCover} — shorts would need time to exit.`);
  }

  // Put/call open interest skew from the front-month chain.
  const pcOi = putCallOiRatio(snapshot);
  if (pcOi != null) {
    if (pcOi >= 1.3) {
      score += 10;
      reasons.push(`Put/call OI ${pcOi.toFixed(2)} — hedges already crowded (contrarian-supportive).`);
    } else if (pcOi <= 0.6) {
      score -= 5;
      reasons.push(`Put/call OI ${pcOi.toFixed(2)} — call-heavy, complacent.`);
    }
  }

  // Implied volatility rank: the core premium-selling signal.
  const ivRank = snapshot.ivRank;
  if (typeof ivRank === 'number') {
    if (ivRank >= config.opportunity.minIvRank) {
      score += Math.min(30, Math.round((ivRank - config.opportunity.minIvRank) / 2) + 10);
      reasons.push(`IV rank ${ivRank} — options richly priced, good for selling premium.`);
    } else {
      score -= 15;
      reasons.push(`IV rank ${ivRank} below ${config.opportunity.minIvRank} — premium too thin to sell.`);
    }
  }

  score = clampScore(score);
  return { lens: 'positioning', score, ivRank, putCallOiRatio: pcOi, reasons };
}

export function putCallOiRatio(snapshot) {
  const exp = frontMonth(snapshot);
  if (!exp) return null;
  const putOi = exp.puts.reduce((a, o) => a + (o.openInterest || 0), 0);
  const callOi = exp.calls.reduce((a, o) => a + (o.openInterest || 0), 0);
  if (callOi === 0) return null;
  return putOi / callOi;
}

export function frontMonth(snapshot) {
  const exps = snapshot.optionChain?.expirations || [];
  return exps.length ? exps.slice().sort((a, b) => a.dte - b.dte)[0] : null;
}

const clampScore = (x) => Math.max(-100, Math.min(100, Math.round(x)));
const pct = (x) => `${(x * 100).toFixed(1)}%`;

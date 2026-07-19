// ─── TECHNICAL LENS ──────────────────────────────────────────────────────────
// Pure functions over the price history. Reports trend, position relative to the
// 50/200-day moving averages, Fibonacci retracement level, and 52-week range.
// Output score is -100 (bearish) .. +100 (bullish) with plain-English reasons.

export function sma(history, period) {
  if (history.length < period) return null;
  const slice = history.slice(-period);
  const sum = slice.reduce((a, b) => a + b.close, 0);
  return round2(sum / period);
}

// 52-week (or full-history) high/low and where price sits within that range.
export function range52w(history) {
  const win = history.slice(-252);
  let hi = -Infinity;
  let lo = Infinity;
  for (const bar of win) {
    if (bar.close > hi) hi = bar.close;
    if (bar.close < lo) lo = bar.close;
  }
  return { hi: round2(hi), lo: round2(lo) };
}

// Standard Fibonacci retracement levels between the range low and high.
// Returns the levels plus the nearest one to the current price.
export function fibRetracement(history, price) {
  const { hi, lo } = range52w(history);
  const span = hi - lo;
  const ratios = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  const levels = ratios.map((r) => ({ ratio: r, price: round2(hi - span * r) }));
  let nearest = levels[0];
  for (const l of levels) {
    if (Math.abs(l.price - price) < Math.abs(nearest.price - price)) nearest = l;
  }
  // Position of price within the range, 0 (at low) .. 1 (at high).
  const positionInRange = span > 0 ? round2((price - lo) / span) : 0;
  return { hi, lo, levels, nearest, positionInRange };
}

export function analyzeTechnical(snapshot, config) {
  const { history, price } = snapshot;
  const ma50 = sma(history, 50);
  const ma200 = sma(history, 200);
  const fib = fibRetracement(history, price);

  const reasons = [];
  let score = 0;

  // Long-term trend: price vs 200DMA.
  if (ma200 != null) {
    if (price > ma200) {
      score += 25;
      reasons.push(`Price ${price} above 200DMA ${ma200} (long-term uptrend).`);
    } else {
      score -= 25;
      reasons.push(`Price ${price} below 200DMA ${ma200} (long-term downtrend).`);
    }
  }

  // Golden/death cross: 50DMA vs 200DMA.
  if (ma50 != null && ma200 != null) {
    if (ma50 > ma200) {
      score += 15;
      reasons.push(`50DMA ${ma50} above 200DMA ${ma200} (bullish structure).`);
    } else {
      score -= 15;
      reasons.push(`50DMA ${ma50} below 200DMA ${ma200} (bearish structure).`);
    }
  }

  // Pullback-to-support: in an uptrend, price near/just-below the 50DMA is a
  // constructive entry for selling puts (buy the dip via premium).
  let pullbackToSupport = false;
  if (ma50 != null && ma200 != null && price > ma200) {
    const distToMa50 = (price - ma50) / ma50;
    if (distToMa50 >= -0.06 && distToMa50 <= 0.03) {
      pullbackToSupport = true;
      score += 20;
      reasons.push(`Price sitting on 50DMA support (${pct(distToMa50)} from ${ma50}) — constructive pullback.`);
    } else if (distToMa50 > 0.15) {
      score -= 10;
      reasons.push(`Price extended ${pct(distToMa50)} above 50DMA — stretched.`);
    }
  }

  // Fib: near a retracement support in the lower-middle of the range is healthy;
  // pinned at the highs is stretched.
  if (fib.positionInRange >= 0.75) {
    score -= 10;
    reasons.push(`Near 52w highs (${pct(fib.positionInRange)} of range) — limited upside cushion.`);
  } else if (fib.positionInRange >= 0.35 && fib.positionInRange <= 0.65) {
    score += 10;
    reasons.push(`Mid-range near ${(fib.nearest.ratio * 100).toFixed(1)}% fib (${fib.nearest.price}).`);
  }

  score = clampScore(score);
  const trend = ma200 == null ? 'unknown' : price > ma200 && (ma50 ?? 0) > ma200 ? 'up' : price < ma200 ? 'down' : 'sideways';

  return {
    lens: 'technical',
    score,
    trend,
    ma50,
    ma200,
    fib,
    pullbackToSupport,
    reasons,
  };
}

const round2 = (x) => Math.round(x * 100) / 100;
const clampScore = (x) => Math.max(-100, Math.min(100, Math.round(x)));
const pct = (x) => `${(x * 100).toFixed(1)}%`;

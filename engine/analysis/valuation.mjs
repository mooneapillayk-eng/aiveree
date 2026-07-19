// ─── VALUATION LENS ──────────────────────────────────────────────────────────
// Cheap vs expensive from a small set of transparent fundamentals. Score is
// -100 (expensive) .. +100 (cheap/attractive) with plain-English reasons.
// Deliberately simple: this is a screen, not a DCF.

export function analyzeValuation(snapshot, config) {
  const f = snapshot.fundamentals || {};
  const v = config.valuation;
  const reasons = [];
  let score = 0;

  // Price-to-sales: the primary cheap/expensive read for growth names.
  if (typeof f.priceToSales === 'number') {
    if (f.priceToSales <= v.cheapPriceToSales) {
      score += 35;
      reasons.push(`P/S ${f.priceToSales} <= ${v.cheapPriceToSales} — inexpensive on sales.`);
    } else if (f.priceToSales >= v.expensivePriceToSales) {
      score -= 35;
      reasons.push(`P/S ${f.priceToSales} >= ${v.expensivePriceToSales} — richly valued on sales.`);
    } else {
      // linear in-between, centred on the midpoint
      const mid = (v.cheapPriceToSales + v.expensivePriceToSales) / 2;
      const s = Math.round((-(f.priceToSales - mid) / (v.expensivePriceToSales - mid)) * 20);
      score += s;
      reasons.push(`P/S ${f.priceToSales} — mid-range valuation.`);
    }
  }

  // Revenue growth: quality offset. Strong growth justifies a higher multiple.
  if (typeof f.revenueGrowthYoY === 'number') {
    if (f.revenueGrowthYoY >= v.healthyRevenueGrowth) {
      score += 20;
      reasons.push(`Revenue growth ${pct(f.revenueGrowthYoY)} YoY — healthy.`);
    } else if (f.revenueGrowthYoY < 0) {
      score -= 20;
      reasons.push(`Revenue shrinking ${pct(f.revenueGrowthYoY)} YoY.`);
    }
  }

  // Balance-sheet safety: cash cushion and leverage.
  if (typeof f.debtToEquity === 'number') {
    if (f.debtToEquity <= 0.3) {
      score += 15;
      reasons.push(`Low leverage (D/E ${f.debtToEquity}).`);
    } else if (f.debtToEquity >= v.maxDebtToEquity) {
      score -= 15;
      reasons.push(`Elevated leverage (D/E ${f.debtToEquity}).`);
    }
  }
  if (typeof f.cashPerShare === 'number' && typeof snapshot.price === 'number' && snapshot.price > 0) {
    const cashPct = f.cashPerShare / snapshot.price;
    if (cashPct >= 0.15) {
      score += 10;
      reasons.push(`Cash is ${pct(cashPct)} of price — solid cushion.`);
    }
  }

  // Profitability signal from margins.
  if (typeof f.grossMargin === 'number' && f.grossMargin >= 0.45) {
    score += 10;
    reasons.push(`Healthy gross margin ${pct(f.grossMargin)}.`);
  }

  score = clampScore(score);
  const label = score >= 25 ? 'cheap' : score <= -25 ? 'expensive' : 'fair';

  return { lens: 'valuation', score, label, reasons };
}

const clampScore = (x) => Math.max(-100, Math.min(100, Math.round(x)));
const pct = (x) => `${(x * 100).toFixed(1)}%`;

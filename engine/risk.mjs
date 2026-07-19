// ─── RISK ENGINE ─────────────────────────────────────────────────────────────
// The gatekeeper. Given a proposed structure and the current portfolio, it:
//   1. applies portfolio-level vetoes (correlation, concurrency, exposure),
//   2. sizes the position conservatively (contracts) against several caps,
//   3. can reduce a trade to zero contracts => veto.
// It never increases risk; every path here only ever shrinks or blocks a trade.

export function assessRisk(structure, portfolio, config) {
  const symbol = structure.symbol;
  const sector = config.sectors[symbol] || 'unknown';

  if (structure.type === 'none') {
    return { approved: false, contracts: 0, reasons: [structure.reason || 'No structure proposed.'], veto: null };
  }

  const reasons = [];
  const equity = portfolio.equity();
  const openPositions = portfolio.openPositions();

  // ── Concurrency cap ─────────────────────────────────────────────────────────
  if (openPositions.length >= config.risk.maxConcurrentPositions) {
    return veto(`Portfolio already holds ${openPositions.length} positions (max ${config.risk.maxConcurrentPositions}).`);
  }

  // ── Correlation cap: limit positions per sector ─────────────────────────────
  const sectorCount = openPositions.filter((p) => (config.sectors[p.symbol] || 'unknown') === sector).length;
  if (sectorCount >= config.risk.maxPositionsPerSector) {
    return veto(`Already ${sectorCount} position(s) in '${sector}' (max ${config.risk.maxPositionsPerSector}) — correlation cap.`);
  }
  // Also block adding a second leg on a name we already hold.
  if (openPositions.some((p) => p.symbol === symbol)) {
    return veto(`Already hold a position in ${symbol}.`);
  }

  // ── Sizing caps ─────────────────────────────────────────────────────────────
  const riskBudget = equity * config.risk.maxRiskPerTradePct;
  const perNameCap = config.account.startingCash * config.risk.maxNotionalPerNamePct;
  const portfolioCap = config.account.startingCash * config.risk.maxPortfolioNotionalPct;
  const committed = portfolio.committedCollateral();
  const remainingPortfolio = Math.max(0, portfolioCap - committed);
  const availableCash = Math.max(0, portfolio.cash - committed);

  const caps = [];
  // Risk-budget cap (defined-risk structures and stop-based CSP risk).
  if (structure.maxLossPerContract > 0) {
    caps.push({ name: 'risk-budget', n: Math.floor(riskBudget / structure.maxLossPerContract) });
  }
  // Collateral / buying-power caps.
  if (structure.collateralPerContract > 0) {
    caps.push({ name: 'per-name-notional', n: Math.floor(perNameCap / structure.collateralPerContract) });
    caps.push({ name: 'portfolio-notional', n: Math.floor(remainingPortfolio / structure.collateralPerContract) });
    caps.push({ name: 'available-cash', n: Math.floor(availableCash / structure.collateralPerContract) });
  }
  // Covered calls are limited by shares held.
  if (structure.type === 'covered_call') {
    caps.push({ name: 'shares-held', n: structure.maxContractsFromShares });
  }
  // Absolute sanity cap so no single decision goes wild.
  caps.push({ name: 'hard-cap', n: 10 });

  const binding = caps.reduce((min, c) => (c.n < min.n ? c : min), { name: 'none', n: Infinity });
  const contracts = Number.isFinite(binding.n) ? Math.max(0, binding.n) : 0;

  for (const c of caps) reasons.push(`${c.name}: ${Number.isFinite(c.n) ? c.n : '∞'} contracts`);

  if (contracts < 1) {
    return {
      approved: false,
      contracts: 0,
      binding: binding.name,
      reasons,
      veto: `Cannot size within caps (binding: ${binding.name}).`,
    };
  }

  const totalCredit = round2((structure.creditPerContract || 0) * contracts);
  const totalMaxLoss = round2((structure.maxLossPerContract || 0) * contracts);
  const totalCollateral = round2((structure.collateralPerContract || 0) * contracts);

  return {
    approved: true,
    contracts,
    binding: binding.name,
    sector,
    totalCredit,
    totalMaxLoss,
    totalCollateral,
    riskBudget: round2(riskBudget),
    portfolioExposureAfter: round2(committed + totalCollateral),
    reasons,
    veto: null,
  };

  function veto(msg) {
    return { approved: false, contracts: 0, reasons: [msg], veto: msg };
  }
}

const round2 = (x) => Math.round(x * 100) / 100;

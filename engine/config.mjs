// ─── OPTIONS PAPER-TRADING ENGINE · CONFIGURATION ────────────────────────────
// Every tunable lives here. The engine is deterministic: same data + same config
// => same decisions. Nothing here reaches out to a broker; this is paper-only.

export const CONFIG = {
  // ── Universe ───────────────────────────────────────────────────────────────
  universe: ['AMD', 'MU', 'XPEV', 'BE', 'EH'],

  // Sector map drives correlation limits in the risk engine. Symbols sharing a
  // sector are treated as correlated exposure.
  sectors: {
    AMD: 'semiconductors',
    MU: 'semiconductors',
    XPEV: 'ev',
    BE: 'clean-energy',
    EH: 'ev', // eVTOL / mobility — grouped with EV for correlation purposes
  },

  // ── Account (paper) ──────────────────────────────────────────────────────────
  account: {
    startingCash: 100_000, // USD notional paper account
    currency: 'USD',
  },

  // ── Risk engine ──────────────────────────────────────────────────────────────
  risk: {
    maxRiskPerTradePct: 0.02, // max loss on any single trade <= 2% of account
    maxNotionalPerNamePct: 0.20, // buying-power committed to one symbol
    maxPortfolioNotionalPct: 0.60, // total committed buying power
    maxPositionsPerSector: 1, // correlation cap
    maxConcurrentPositions: 5,
    minCreditToWidthRatio: 0.20, // a credit spread must pay >= 20% of its width
    // Cash-secured puts are not defined-risk. Rather than budget stock-to-zero,
    // we assume a mechanical stop at N x the credit received and size to that.
    cspStopLossMultiple: 2.5,
  },

  // ── Liquidity gates (per option leg) ─────────────────────────────────────────
  liquidity: {
    minOpenInterest: 250,
    minContractVolume: 10,
    maxBidAskSpreadPct: 0.15, // (ask-bid)/mid must be <= 15%
    minUnderlyingAvgVolume: 500_000,
  },

  // ── Opportunity thresholds ───────────────────────────────────────────────────
  opportunity: {
    earningsBlackoutDays: 7, // no new trade if earnings within N days
    minIvRank: 30, // premium selling wants elevated IV (0-100)
    minConviction: 40, // combined conviction (0-100) required to trade
    targetDeltaShort: 0.30, // sell roughly the 30-delta option
    dteMin: 25,
    dteMax: 45,
    putSpreadWidth: 5, // strikes-dollars width for defined-risk put spreads
  },

  // ── Valuation thresholds ─────────────────────────────────────────────────────
  valuation: {
    cheapPriceToSales: 3, // <= is cheap-ish
    expensivePriceToSales: 10, // >= is expensive
    healthyRevenueGrowth: 0.15, // 15% YoY
    maxDebtToEquity: 2.0,
  },

  // ── Execution (paper fill model) ─────────────────────────────────────────────
  execution: {
    // Sell orders are placed at a limit between mid and ask. If the spread is
    // within tolerance we assume a mid fill; otherwise we fill at the bid
    // (conservative for a seller).
    limitAtPctOfMid: 1.0, // 1.0 = place at mid
    midFillMaxSpreadPct: 0.10,
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || null,
    chatId: process.env.TELEGRAM_CHAT_ID || null,
    // When token/chat are absent the reporter prints to the console instead.
  },

  // ── Screener (candidate discovery) ───────────────────────────────────────────
  // Finds NEW names beyond the fixed universe and promotes the best into the run.
  // Dormant unless the data provider supports discovery (mock does not), because
  // scanning a broad market list needs a live feed. See engine/screener.mjs.
  screener: {
    enabled: true, // gate; still dormant unless the provider supports discovery
    maxNewCandidates: 5, // promote at most N fresh names per run
    minScreenScore: 45, // composite floor a candidate must clear to be promoted
  },

  // ── Data provider ────────────────────────────────────────────────────────────
  dataProvider: process.env.ENGINE_DATA_PROVIDER || 'mock', // 'mock' | 'live'

  // Live provider (Yahoo Finance, no API key). See engine/data/liveProvider.mjs.
  live: {
    riskFreeRate: 0.04, // used to compute Black-Scholes option deltas from IV
    historyRange: '1y', // price history window for DMAs / IV-rank proxy
    maxExpiries: 3, // option expiries to pull within the DTE window
    requestTimeoutMs: 15_000,
    // Broad candidate list the screener ranks when discovery is on. Yahoo has no
    // stable keyless "movers" feed, so discovery draws from this list (edit
    // freely) plus the core universe.
    candidateList: [
      'AMD', 'MU', 'XPEV', 'BE', 'EH',
      'NVDA', 'INTC', 'SMCI', 'PLTR', 'SOFI',
      'RIVN', 'LCID', 'NIO', 'F', 'T',
      'PYPL', 'SHOP', 'COIN', 'MARA', 'RIOT',
    ],
  },

  // ── State ────────────────────────────────────────────────────────────────────
  statePath: process.env.ENGINE_STATE_PATH || 'engine/state/portfolio.json',
};

export default CONFIG;

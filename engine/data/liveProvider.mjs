// ─── LIVE DATA PROVIDER (Yahoo Finance, no API key) ──────────────────────────
// Produces the same normalised snapshot as the mock provider, from live Yahoo
// endpoints. Yahoo needs no key — these are the endpoints yfinance uses:
//   chart        v8/finance/chart/{sym}            price history + last price
//   options      v7/finance/options/{sym}[?date=]  option chain (IV, no greeks)
//   quoteSummary v10/finance/quoteSummary/{sym}     fundamentals + short interest
//                                                   + earnings date (needs crumb)
// Yahoo does NOT return option greeks, so deltas are computed with Black-Scholes
// from each contract's implied volatility. Yahoo also does not expose an IV-rank
// history, so IV rank is approximated from a realized-volatility percentile
// (documented as a proxy).
//
// The HTTP layer is kept thin and every sub-fetch degrades gracefully: if
// fundamentals / earnings can't be fetched the snapshot still returns (the
// analysis lenses already guard missing fields). The pure mapping functions are
// exported and unit-tested without any network access.

// ── pure math ────────────────────────────────────────────────────────────────
function gaussianCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

// Black-Scholes delta from implied volatility. Puts are signed negative.
export function bsDelta({ spot, strike, dte, iv, right, riskFreeRate = 0.04 }) {
  const T = Math.max(dte, 0) / 365;
  if (!(spot > 0) || !(strike > 0) || !(iv > 0) || T <= 0) {
    // Degenerate inputs: fall back to intrinsic moneyness (0/±1).
    if (right === 'put') return spot < strike ? -1 : 0;
    return spot > strike ? 1 : 0;
  }
  const d1 = (Math.log(spot / strike) + (riskFreeRate + 0.5 * iv * iv) * T) / (iv * Math.sqrt(T));
  const nd1 = gaussianCdf(d1);
  return right === 'put' ? round2(nd1 - 1) : round2(nd1);
}

// IV-rank proxy: percentile of the latest 21-day realized volatility within the
// trailing year of 21-day realized vols. 0..100. A stand-in for true IV rank
// (Yahoo gives no historical IV).
export function computeIvRankProxy(history, window = 21) {
  if (!history || history.length < window * 2 + 2) return null;
  const closes = history.map((b) => b.close);
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const vols = [];
  for (let i = window; i <= rets.length; i++) {
    const slice = rets.slice(i - window, i);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const varr = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    vols.push(Math.sqrt(varr) * Math.sqrt(252));
  }
  if (vols.length < 2) return null;
  const latest = vols[vols.length - 1];
  const below = vols.filter((v) => v <= latest).length;
  return Math.round((below / vols.length) * 100);
}

// ── pure mappers (Yahoo JSON -> snapshot fields) ─────────────────────────────
export function mapChart(chartJson) {
  const r = chartJson?.chart?.result?.[0];
  if (!r) throw new Error('chart: no result');
  const ts = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const closes = q.close || [];
  const vols = q.volume || [];
  const history = [];
  for (let i = 0; i < ts.length; i++) {
    if (closes[i] == null) continue;
    history.push({
      date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      close: round2(closes[i]),
      volume: vols[i] || 0,
    });
  }
  const price = r.meta?.regularMarketPrice ?? (history.length ? history[history.length - 1].close : null);
  const prevClose = r.meta?.chartPreviousClose ?? (history.length > 1 ? history[history.length - 2].close : price);
  const avgVolume = vols.length ? Math.round(vols.filter((v) => v).reduce((a, b) => a + b, 0) / vols.filter((v) => v).length) : 0;
  return { price: round2(price), prevClose: round2(prevClose), volume: vols[vols.length - 1] || 0, avgVolume, history };
}

export function mapFundamentals(summaryJson) {
  const r = summaryJson?.quoteSummary?.result?.[0] || {};
  const sd = r.summaryDetail || {};
  const ks = r.defaultKeyStatistics || {};
  const fd = r.financialData || {};
  const cal = r.calendarEvents || {};
  const raw = (x) => (x && typeof x === 'object' ? (typeof x.raw === 'number' ? x.raw : null) : typeof x === 'number' ? x : null);

  const fundamentals = {
    priceToSales: raw(sd.priceToSalesTrailing12Months),
    forwardPe: raw(sd.forwardPE) ?? raw(ks.forwardPE),
    revenueGrowthYoY: raw(fd.revenueGrowth),
    grossMargin: raw(fd.grossMargins),
    cashPerShare: raw(fd.totalCashPerShare),
    // Yahoo reports debt/equity as a percentage (e.g. 42.1 => 0.42).
    debtToEquity: raw(fd.debtToEquity) != null ? round2(raw(fd.debtToEquity) / 100) : null,
    marketCap: raw(sd.marketCap),
  };
  const shortInterest = {
    percentFloat: raw(ks.shortPercentOfFloat),
    daysToCover: raw(ks.shortRatio),
  };
  const earningsRaw = cal.earnings?.earningsDate?.[0];
  const earnings = { nextDate: raw(earningsRaw) != null ? new Date(raw(earningsRaw) * 1000).toISOString().slice(0, 10) : null };
  return { fundamentals, shortInterest, earnings };
}

// Map one Yahoo option contract into our normalised option, computing delta.
export function mapOptionContract(raw, { spot, dte, right, riskFreeRate }) {
  const bid = num(raw.bid);
  const ask = num(raw.ask);
  const iv = num(raw.impliedVolatility);
  return {
    strike: num(raw.strike),
    bid: round2(bid),
    ask: round2(ask ?? bid),
    iv: iv != null ? round2(iv) : null,
    openInterest: raw.openInterest ?? 0,
    volume: raw.volume ?? 0,
    delta: iv != null ? bsDelta({ spot, strike: num(raw.strike), dte, iv, right, riskFreeRate }) : null,
  };
}

// Build the optionChain field from a set of per-expiry Yahoo option payloads.
export function assembleChain(expiryPayloads, { spot, asOf, riskFreeRate }) {
  const asOfMs = new Date(asOf + 'T00:00:00Z').getTime();
  const expirations = [];
  for (const p of expiryPayloads) {
    const opt = p?.optionChain?.result?.[0]?.options?.[0];
    if (!opt) continue;
    const expUnix = opt.expirationDate;
    const expiry = new Date(expUnix * 1000).toISOString().slice(0, 10);
    const dte = Math.round((expUnix * 1000 - asOfMs) / 86_400_000);
    expirations.push({
      expiry,
      dte,
      calls: (opt.calls || []).map((c) => mapOptionContract(c, { spot, dte, right: 'call', riskFreeRate })),
      puts: (opt.puts || []).map((c) => mapOptionContract(c, { spot, dte, right: 'put', riskFreeRate })),
    });
  }
  return { asOf, expirations };
}

// Assemble a full normalised snapshot from already-fetched Yahoo payloads.
export function assembleSnapshot({ symbol, asOf, chartJson, summaryJson, expiryPayloads, config }) {
  const chart = mapChart(chartJson);
  const spot = chart.price;
  const rate = config.live.riskFreeRate;
  let fundamentals = {};
  let shortInterest = {};
  let earnings = { nextDate: null };
  if (summaryJson) {
    try {
      ({ fundamentals, shortInterest, earnings } = mapFundamentals(summaryJson));
    } catch {
      /* leave fundamentals empty — lenses tolerate missing fields */
    }
  }
  return {
    symbol,
    asOf,
    price: spot,
    prevClose: chart.prevClose,
    volume: chart.volume,
    avgVolume: chart.avgVolume,
    history: chart.history,
    fundamentals,
    shortInterest,
    earnings,
    ivRank: computeIvRankProxy(chart.history),
    optionChain: assembleChain(expiryPayloads || [], { spot, asOf, riskFreeRate: rate }),
  };
}

// ── provider (HTTP orchestration) ────────────────────────────────────────────
const BASE = 'https://query1.finance.yahoo.com';
const UA = { 'User-Agent': 'Mozilla/5.0 (options-engine)' };

export class LiveProvider {
  constructor(config) {
    this.config = config;
    this.name = 'yahoo';
    this.asOf = new Date().toISOString().slice(0, 10);
    this.supportsDiscovery = true;
    this._crumb = null;
    this._cookie = null;
  }

  async _json(url, headers = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.config.live.requestTimeoutMs);
    try {
      const res = await fetch(url, { headers: { ...UA, ...headers }, signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Yahoo's quoteSummary requires a cookie + crumb pair (as yfinance does).
  async _ensureCrumb() {
    if (this._crumb) return;
    const res = await fetch('https://fc.yahoo.com/', { headers: UA });
    this._cookie = res.headers.get('set-cookie') || '';
    this._crumb = await (await fetch(`${BASE}/v1/test/getcrumb`, { headers: { ...UA, Cookie: this._cookie } })).text();
  }

  async fetchSnapshot(symbol) {
    const asOf = this.asOf;
    const chartJson = await this._json(`${BASE}/v8/finance/chart/${symbol}?range=${this.config.live.historyRange}&interval=1d`);

    // Fundamentals / short interest / earnings — best effort (crumb-gated).
    let summaryJson = null;
    try {
      await this._ensureCrumb();
      const modules = 'summaryDetail,defaultKeyStatistics,financialData,calendarEvents';
      summaryJson = await this._json(
        `${BASE}/v10/finance/quoteSummary/${symbol}?modules=${modules}&crumb=${encodeURIComponent(this._crumb)}`,
        { Cookie: this._cookie }
      );
    } catch (err) {
      console.error(`[live] fundamentals unavailable for ${symbol}: ${err.message}`);
    }

    // Option expiries within the DTE window (cap at maxExpiries).
    const expiryPayloads = [];
    try {
      const root = await this._json(`${BASE}/v7/finance/options/${symbol}`);
      const dates = root?.optionChain?.result?.[0]?.expirationDates || [];
      const asOfMs = new Date(asOf + 'T00:00:00Z').getTime();
      const inWindow = dates.filter((d) => {
        const dte = Math.round((d * 1000 - asOfMs) / 86_400_000);
        return dte >= this.config.opportunity.dteMin && dte <= this.config.opportunity.dteMax;
      });
      const chosen = inWindow.slice(0, this.config.live.maxExpiries);
      if (chosen.length === 0 && root?.optionChain?.result?.[0]?.options?.[0]) {
        expiryPayloads.push(root); // fall back to the front expiry Yahoo returned
      }
      for (const d of chosen) {
        expiryPayloads.push(await this._json(`${BASE}/v7/finance/options/${symbol}?date=${d}`));
      }
    } catch (err) {
      console.error(`[live] option chain unavailable for ${symbol}: ${err.message}`);
    }

    return assembleSnapshot({ symbol, asOf, chartJson, summaryJson, expiryPayloads, config: this.config });
  }

  // Discovery candidate list. Yahoo has no stable keyless movers feed, so we use
  // the configured candidate list (the screener filters/ranks it downstream).
  async listCandidates() {
    return this.config.live.candidateList || [];
  }
}

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : x == null ? null : Number(x));
const round2 = (x) => (x == null ? x : Math.round(x * 100) / 100);

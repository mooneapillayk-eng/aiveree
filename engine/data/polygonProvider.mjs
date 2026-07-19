// ─── POLYGON.IO ("MASSIVE") DATA PROVIDER ────────────────────────────────────
// Real vendor greeks + implied volatility, so option deltas are NOT modelled —
// they come straight from Polygon. Requires POLYGON_API_KEY. The Options Starter
// tier ($29/mo) is sufficient: 15-min-delayed prices are fine for a once-a-day
// paper engine, and it ships real greeks + IV plus 2y history.
//
// Endpoints used:
//   /v2/aggs/ticker/{t}/range/1/day/{from}/{to}   daily bars (history, price)
//   /v3/snapshot/options/{underlying}             option chain w/ greeks + IV
//   /v3/reference/tickers/{t}                      market cap, shares
//   /vX/reference/financials?ticker={t}            revenue, margins, leverage
//   /v3/reference/short-interest?ticker={t}        short interest (best-effort)
//
// IV RANK and EARNINGS are applied centrally by the orchestrator (IV-rank store
// + earnings-calendar overlay), because a true IV rank needs accumulated history
// and Polygon's cheap tiers ship no earnings calendar. This provider sets a
// realized-vol proxy as the IV-rank fallback and leaves earnings null.
//
// Every fundamentals call is best-effort: if it fails the snapshot still returns
// and the analysis lenses tolerate the missing fields.

import { computeIvRankProxy } from './liveProvider.mjs';

// ── pure mappers (Polygon JSON -> snapshot fields) ───────────────────────────
export function mapAggs(aggsJson) {
  const rows = aggsJson?.results || [];
  if (!rows.length) throw new Error('aggs: no results');
  const history = rows
    .filter((r) => r.c != null)
    .map((r) => ({ date: new Date(r.t).toISOString().slice(0, 10), close: round2(r.c), volume: r.v || 0 }));
  const price = history[history.length - 1].close;
  const prevClose = history.length > 1 ? history[history.length - 2].close : price;
  const vols = history.map((h) => h.volume).filter((v) => v);
  const avgVolume = vols.length ? Math.round(vols.reduce((a, b) => a + b, 0) / vols.length) : 0;
  return { price, prevClose, volume: history[history.length - 1].volume, avgVolume, history };
}

// Group Polygon option-snapshot contracts into our normalised chain. Uses the
// VENDOR delta and IV directly (no Black-Scholes).
export function mapOptionsSnapshot(results, { asOf, config }) {
  const asOfMs = new Date(asOf + 'T00:00:00Z').getTime();
  const byExpiry = new Map();
  for (const r of results || []) {
    const d = r.details || {};
    const expiry = d.expiration_date;
    if (!expiry) continue;
    const dte = Math.round((new Date(expiry + 'T00:00:00Z').getTime() - asOfMs) / 86_400_000);
    if (dte < config.opportunity.dteMin || dte > config.opportunity.dteMax) continue;
    const q = r.last_quote || {};
    const bid = num(q.bid);
    const ask = num(q.ask);
    const opt = {
      strike: num(d.strike_price),
      bid: round2(bid ?? 0),
      ask: round2(ask ?? bid ?? 0),
      iv: r.implied_volatility != null ? round2(r.implied_volatility) : null,
      openInterest: r.open_interest ?? 0,
      volume: r.day?.volume ?? 0,
      delta: r.greeks?.delta != null ? round2(r.greeks.delta) : null,
    };
    if (!byExpiry.has(expiry)) byExpiry.set(expiry, { expiry, dte, calls: [], puts: [] });
    const bucket = byExpiry.get(expiry);
    if (d.contract_type === 'put') bucket.puts.push(opt);
    else if (d.contract_type === 'call') bucket.calls.push(opt);
  }
  const expirations = Array.from(byExpiry.values())
    .sort((a, b) => a.dte - b.dte)
    .slice(0, config.polygon.maxExpiries);
  for (const e of expirations) {
    e.calls.sort((a, b) => a.strike - b.strike);
    e.puts.sort((a, b) => a.strike - b.strike);
  }
  return { asOf, expirations };
}

// Build fundamentals + short interest from Polygon reference/financials data.
// Defensive: any missing figure becomes null (lenses guard for it).
export function mapFundamentals({ tickerDetails, financials, shortInterest, price }) {
  const t = tickerDetails?.results || {};
  const reports = financials?.results || [];
  const marketCap = num(t.market_cap);
  const shares = num(t.weighted_shares_outstanding) ?? num(t.share_class_shares_outstanding);

  // Trailing-twelve-month revenue from up to 4 quarterly reports.
  const revValues = reports.map((r) => num(r?.financials?.income_statement?.revenues?.value)).filter((v) => v != null);
  const ttmRevenue = revValues.slice(0, 4).reduce((a, b) => a + b, 0) || null;
  const grossProfit = num(reports[0]?.financials?.income_statement?.gross_profit?.value);
  const latestRev = revValues[0] ?? null;
  const yearAgoRev = revValues[4] ?? revValues[revValues.length - 1] ?? null; // ~4 quarters back if present
  const equity = num(reports[0]?.financials?.balance_sheet?.equity?.value);
  const liabilities = num(reports[0]?.financials?.balance_sheet?.liabilities?.value);

  const fundamentals = {
    priceToSales: marketCap != null && ttmRevenue ? round2(marketCap / ttmRevenue) : null,
    forwardPe: null, // not on the free financials feed
    revenueGrowthYoY:
      latestRev != null && yearAgoRev ? round2(latestRev / yearAgoRev - 1) : null,
    grossMargin: grossProfit != null && latestRev ? round2(grossProfit / latestRev) : null,
    cashPerShare: null, // not reliably present; left null
    debtToEquity: liabilities != null && equity ? round2(liabilities / equity) : null,
    marketCap,
  };
  const si = shortInterest?.results?.[0] || shortInterest?.results || {};
  const shortInt = {
    percentFloat: num(si.short_interest_percent_of_float) ?? (num(si.short_interest) != null && shares ? round2(num(si.short_interest) / shares) : null),
    daysToCover: num(si.days_to_cover),
  };
  return { fundamentals, shortInterest: shortInt };
}

export function assembleSnapshot({ symbol, asOf, aggsJson, optionResults, fundamentalsInputs, config }) {
  const aggs = mapAggs(aggsJson);
  let fundamentals = {};
  let shortInterest = {};
  if (fundamentalsInputs) {
    try {
      ({ fundamentals, shortInterest } = mapFundamentals({ ...fundamentalsInputs, price: aggs.price }));
    } catch {
      /* keep empty */
    }
  }
  return {
    symbol,
    asOf,
    price: aggs.price,
    prevClose: aggs.prevClose,
    volume: aggs.volume,
    avgVolume: aggs.avgVolume,
    history: aggs.history,
    fundamentals,
    shortInterest,
    earnings: { nextDate: null }, // supplied by the earnings-calendar overlay
    ivRank: computeIvRankProxy(aggs.history), // proxy fallback; IV-store overlay refines it
    optionChain: mapOptionsSnapshot(optionResults || [], { asOf, config }),
  };
}

// ── provider (HTTP orchestration) ────────────────────────────────────────────
export class PolygonProvider {
  constructor(config) {
    this.config = config;
    this.name = 'polygon';
    this.asOf = new Date().toISOString().slice(0, 10);
    this.supportsDiscovery = true;
    this.usesIvStore = true; // orchestrator computes true IV rank
    this.usesEarningsOverride = true; // orchestrator applies earnings calendar
    if (!config.polygon.apiKey) {
      throw new Error('POLYGON_API_KEY is not set — required for the polygon provider.');
    }
  }

  _url(path, params = {}) {
    const u = new URL(this.config.polygon.baseUrl + path);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    u.searchParams.set('apiKey', this.config.polygon.apiKey);
    return u.toString();
  }

  async _json(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.config.polygon.requestTimeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${redact(url)}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchSnapshot(symbol) {
    const asOf = this.asOf;
    const from = daysAgoIso(this.config.polygon.historyDays);
    const aggsJson = await this._json(
      this._url(`/v2/aggs/ticker/${symbol}/range/1/day/${from}/${asOf}`, { adjusted: 'true', sort: 'asc', limit: 50000 })
    );
    const spot = mapAggs(aggsJson).price;

    // Focused option-chain query: only strikes near the money and expiries in
    // the DTE window — one bounded request, real greeks + IV.
    let optionResults = [];
    try {
      const expLo = addDaysIso(asOf, this.config.opportunity.dteMin);
      const expHi = addDaysIso(asOf, this.config.opportunity.dteMax);
      const chain = await this._json(
        this._url(`/v3/snapshot/options/${symbol}`, {
          'expiration_date.gte': expLo,
          'expiration_date.lte': expHi,
          'strike_price.gte': Math.floor(spot * 0.7),
          'strike_price.lte': Math.ceil(spot * 1.3),
          limit: 250,
        })
      );
      optionResults = chain.results || [];
    } catch (err) {
      console.error(`[polygon] option chain unavailable for ${symbol}: ${err.message}`);
    }

    // Fundamentals + short interest — all best-effort.
    let fundamentalsInputs = null;
    try {
      const [tickerDetails, financials, shortInterest] = await Promise.all([
        this._json(this._url(`/v3/reference/tickers/${symbol}`)).catch(() => null),
        this._json(this._url(`/vX/reference/financials`, { ticker: symbol, timeframe: 'quarterly', limit: 6, order: 'desc', sort: 'period_of_report_date' })).catch(() => null),
        // NOTE: verify the short-interest path for your plan; null-safe if absent.
        this._json(this._url(`/v3/reference/short-interest`, { ticker: symbol, limit: 1 })).catch(() => null),
      ]);
      fundamentalsInputs = { tickerDetails, financials, shortInterest };
    } catch (err) {
      console.error(`[polygon] fundamentals unavailable for ${symbol}: ${err.message}`);
    }

    return assembleSnapshot({ symbol, asOf, aggsJson, optionResults, fundamentalsInputs, config: this.config });
  }

  async listCandidates() {
    return this.config.polygon.candidateList || this.config.live.candidateList || [];
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────
function daysAgoIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const redact = (url) => url.replace(/apiKey=[^&]+/, 'apiKey=***');
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : x == null ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const round2 = (x) => (x == null ? x : Math.round(x * 100) / 100);

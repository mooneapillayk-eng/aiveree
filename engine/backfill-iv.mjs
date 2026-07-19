#!/usr/bin/env node
// ─── IV-HISTORY BACKFILL (Polygon) ───────────────────────────────────────────
// Seeds the IV-rank store with REAL historical at-the-money implied volatility so
// IV rank is genuine on day one instead of warming up over ~40 daily runs.
//
// Polygon exposes no historical-IV series, so we reconstruct it: for each past
// sampling date we take the near-ATM monthly option's daily close (option
// aggregates) and invert Black-Scholes to recover that day's IV.
//
//   POLYGON_API_KEY=... node engine/backfill-iv.mjs [--symbols=A,B] [--weekly=5] [--lookback=365]
//
// It is idempotent (the store dedupes by date) and only writes the IV-history
// file — it never touches the paper ledger.

import { CONFIG } from './config.mjs';
import { IvStore } from './ivstore.mjs';

// ── pure math + helpers (unit-tested) ────────────────────────────────────────
export function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

export function bsPrice({ spot, strike, T, r, sigma, right }) {
  const st = sigma * Math.sqrt(T);
  if (st <= 0) return right === 'call' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const d1 = (Math.log(spot / strike) + (r + 0.5 * sigma * sigma) * T) / st;
  const d2 = d1 - st;
  return right === 'call'
    ? spot * normCdf(d1) - strike * Math.exp(-r * T) * normCdf(d2)
    : strike * Math.exp(-r * T) * normCdf(-d2) - spot * normCdf(-d1);
}

// Invert Black-Scholes for implied volatility via bisection. Returns null when
// the price is outside the no-arbitrage band (can't imply a sane vol).
export function impliedVol({ price, spot, strike, T, r, right }) {
  if (!(price > 0) || !(spot > 0) || !(strike > 0) || !(T > 0)) return null;
  const f = (s) => bsPrice({ spot, strike, T, r, sigma: s, right }) - price;
  let lo = 1e-4;
  let hi = 5.0;
  let flo = f(lo);
  let fhi = f(hi);
  if (flo > 0 || fhi < 0) return null; // price below intrinsic or above cap
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-6) return round4(mid);
    if (fm < 0) {
      lo = mid;
      flo = fm;
    } else {
      hi = mid;
      fhi = fm;
    }
  }
  return round4((lo + hi) / 2);
}

// Third Friday of a given year / month (0-indexed month) — standard monthly expiry.
export function thirdFriday(year, month0) {
  const first = new Date(Date.UTC(year, month0, 1));
  const firstFridayDate = 1 + ((5 - first.getUTCDay() + 7) % 7);
  return new Date(Date.UTC(year, month0, firstFridayDate + 14));
}

// Pick the standard monthly expiry whose DTE from `dateISO` best fits the window.
export function pickMonthlyExpiry(dateISO, config) {
  const date = new Date(dateISO + 'T00:00:00Z');
  const targetDte = (config.opportunity.dteMin + config.opportunity.dteMax) / 2;
  const candidates = [];
  for (let m = 0; m <= 3; m++) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + m, 1));
    const tf = thirdFriday(d.getUTCFullYear(), d.getUTCMonth());
    const dte = Math.round((tf.getTime() - date.getTime()) / 86_400_000);
    if (dte > 0) candidates.push({ expiry: tf.toISOString().slice(0, 10), dte });
  }
  const inWindow = candidates.filter((c) => c.dte >= config.opportunity.dteMin && c.dte <= config.opportunity.dteMax);
  const pool = inWindow.length ? inWindow : candidates;
  if (!pool.length) return null;
  return pool.sort((a, b) => Math.abs(a.dte - targetDte) - Math.abs(b.dte - targetDte))[0];
}

// Nearest standard strike to a price (increment scales with price level).
export function nearestStandardStrike(price) {
  const incr = price < 25 ? 1 : price < 200 ? 5 : 10;
  return Math.round(price / incr) * incr;
}

// OCC option symbol, e.g. O:AMD260821C00145000
export function occTicker(symbol, expiryISO, right, strike) {
  const yymmdd = expiryISO.slice(2).replace(/-/g, '');
  const cp = right === 'call' ? 'C' : 'P';
  const strikePart = String(Math.round(strike * 1000)).padStart(8, '0');
  return `O:${symbol}${yymmdd}${cp}${strikePart}`;
}

// Build one IV sample from a historical option close (pure, testable).
export function ivSampleFromClose({ optionClose, spot, strike, expiryISO, dateISO, right, riskFreeRate }) {
  const T = Math.max(1, daysBetween(dateISO, expiryISO)) / 365;
  return impliedVol({ price: optionClose, spot, strike, T, r: riskFreeRate, right });
}

// ── HTTP orchestration ───────────────────────────────────────────────────────
async function polyJson(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function runBackfill(config, { symbols, samplingDays = 5, lookbackDays = 365 } = {}) {
  const key = config.polygon.apiKey;
  if (!key) throw new Error('POLYGON_API_KEY is not set — required to backfill IV history.');
  const base = config.polygon.baseUrl;
  const timeout = config.polygon.requestTimeoutMs;
  const rate = config.polygon.riskFreeRate;
  const list = symbols && symbols.length ? symbols : config.universe;
  const store = new IvStore(config);
  const asOf = new Date().toISOString().slice(0, 10);
  const from = addDaysIso(asOf, -lookbackDays);
  const summary = {};

  for (const symbol of list) {
    let recorded = 0;
    let attempted = 0;
    try {
      const aggs = await polyJson(
        `${base}/v2/aggs/ticker/${symbol}/range/1/day/${from}/${asOf}?adjusted=true&sort=asc&limit=50000&apiKey=${key}`,
        timeout
      );
      const rows = (aggs.results || []).filter((r) => r.c != null);
      for (let i = 0; i < rows.length; i += samplingDays) {
        const row = rows[i];
        const dateISO = new Date(row.t).toISOString().slice(0, 10);
        const spot = row.c;
        const exp = pickMonthlyExpiry(dateISO, config);
        if (!exp) continue;
        const strike = nearestStandardStrike(spot);
        const ticker = occTicker(symbol, exp.expiry, 'call', strike);
        attempted++;
        try {
          const optAgg = await polyJson(
            `${base}/v2/aggs/ticker/${ticker}/range/1/day/${dateISO}/${dateISO}?adjusted=true&limit=1&apiKey=${key}`,
            timeout
          );
          const optClose = optAgg.results?.[0]?.c;
          if (optClose == null) continue;
          const iv = ivSampleFromClose({ optionClose: optClose, spot, strike, expiryISO: exp.expiry, dateISO, right: 'call', riskFreeRate: rate });
          if (iv != null) {
            store.record(symbol, dateISO, iv);
            recorded++;
          }
        } catch {
          /* skip a missing/illiquid day */
        }
      }
    } catch (err) {
      console.error(`[backfill] ${symbol}: ${err.message}`);
    }
    summary[symbol] = { recorded, attempted };
    console.log(`[backfill] ${symbol}: recorded ${recorded}/${attempted} IV samples`);
  }

  store.save();
  return { summary, path: config.ivStore.path };
}

// ── helpers ──────────────────────────────────────────────────────────────────
function daysBetween(aISO, bISO) {
  return Math.round((new Date(bISO + 'T00:00:00Z') - new Date(aISO + 'T00:00:00Z')) / 86_400_000);
}
function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
const round4 = (x) => Math.round(x * 10000) / 10000;

// ── CLI ──────────────────────────────────────────────────────────────────────
function isMain() {
  return import.meta.url === `file://${process.argv[1]}`;
}

if (isMain()) {
  const opts = { symbols: null, samplingDays: 5, lookbackDays: 365 };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--symbols=')) opts.symbols = arg.split('=')[1].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    else if (arg.startsWith('--weekly=')) opts.samplingDays = Math.max(1, parseInt(arg.split('=')[1], 10) || 5);
    else if (arg.startsWith('--lookback=')) opts.lookbackDays = Math.max(30, parseInt(arg.split('=')[1], 10) || 365);
    else if (arg === '--help' || arg === '-h') {
      console.log('Usage: POLYGON_API_KEY=... node engine/backfill-iv.mjs [--symbols=A,B] [--weekly=N] [--lookback=DAYS]');
      process.exit(0);
    }
  }
  runBackfill(CONFIG, opts)
    .then((r) => {
      const total = Object.values(r.summary).reduce((a, s) => a + s.recorded, 0);
      console.log(`\nBackfill complete — ${total} IV samples written to ${r.path}`);
    })
    .catch((err) => {
      if (/POLYGON_API_KEY/.test(String(err.message))) {
        console.error('Backfill needs a Polygon key. Set POLYGON_API_KEY (Options Starter tier is enough).');
      } else {
        console.error('Backfill failed:', err.message);
      }
      process.exit(1);
    });
}

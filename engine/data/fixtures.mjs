// ─── DETERMINISTIC MARKET FIXTURES ───────────────────────────────────────────
// Hand-tuned so a paper run exercises every branch of the engine:
//   AMD  -> attractive bullish pullback, elevated IV        => CSP / put spread
//   MU   -> also attractive, but semiconductors (correlated) => risk veto vs AMD
//   XPEV -> earnings inside the blackout window              => no trade (event)
//   BE   -> thin option chain                                => no trade (liquidity)
//   EH   -> richly valued, we already own 100 shares         => covered call
//
// No randomness at runtime: histories are built from a smooth trend + wobble so
// moving averages and Fibonacci levels are reproducible. Prices are USD.

const AS_OF = '2026-07-17'; // a Friday; fixtures are frozen to this date

// Build a daily close series ending `days` back from AS_OF.
// close(t) = start * (1 + drift*t) * (1 + wobble*sin(t/period)), with an
// optional late `dip` applied to the final `dipLen` sessions to model a pullback.
function genSeries({ start, days, drift, wobble = 0.04, period = 21, dip = 0, dipLen = 12 }) {
  const out = [];
  const base = new Date(AS_OF + 'T00:00:00Z');
  for (let t = 0; t < days; t++) {
    let c = start * (1 + drift * t) * (1 + wobble * Math.sin(t / period));
    const fromEnd = days - 1 - t;
    if (dip && fromEnd < dipLen) {
      // linearly ramp the dip in over the last dipLen sessions
      c *= 1 - dip * (1 - fromEnd / dipLen);
    }
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - fromEnd);
    out.push({ date: d.toISOString().slice(0, 10), close: round2(c), volume: 0 });
  }
  return out;
}

const round2 = (x) => Math.round(x * 100) / 100;

// Build one side of an option chain around `spot` for a given expiry.
// `quality` scales open interest / volume so we can model thin vs deep chains.
function genLeg(spot, expiry, dte, side, iv, quality = 1) {
  const legs = [];
  const step = spot >= 100 ? 5 : spot >= 40 ? 2.5 : 1;
  const lo = round2(spot * 0.7);
  const hi = round2(spot * 1.3);
  for (let k = Math.ceil(lo / step) * step; k <= hi; k += step) {
    const strike = round2(k);
    // crude but monotonic delta model: distance from spot in IV-scaled units
    const moneyness = (strike - spot) / (spot * iv * Math.sqrt(dte / 365));
    // |delta| grows as the option goes in-the-money. Puts: strike below spot
    // (moneyness<0) is OTM -> small |delta|. Calls: mirror image.
    let delta;
    if (side === 'put') {
      delta = -clamp(cdf(moneyness), 0.01, 0.99);
    } else {
      delta = clamp(cdf(-moneyness), 0.01, 0.99);
    }
    // premium ~ intrinsic + time value driven by IV and nearness to the money
    const intrinsic =
      side === 'put' ? Math.max(0, strike - spot) : Math.max(0, spot - strike);
    const timeValue = spot * iv * Math.sqrt(dte / 365) * gaussian(moneyness) * 0.9;
    const mid = round2(Math.max(0.02, intrinsic + timeValue));
    const spread = round2(Math.max(0.02, mid * 0.04));
    const atmness = 1 - Math.min(1, Math.abs(strike - spot) / (spot * 0.3));
    legs.push({
      strike,
      bid: round2(Math.max(0.01, mid - spread / 2)),
      ask: round2(mid + spread / 2),
      iv: round2(iv),
      openInterest: Math.round(2000 * atmness * quality) + 20,
      volume: Math.round(300 * atmness * quality) + 1,
      delta: round2(delta),
    });
  }
  return legs;
}

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
// standard normal pdf/cdf (Abramowitz-Stegun) — deterministic, no deps
function gaussian(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function cdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = gaussian(x);
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

function chain(spot, ivRank, iv, quality = 1) {
  const expirations = [21, 35, 49].map((dte) => {
    const d = new Date(AS_OF + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + dte);
    return {
      expiry: d.toISOString().slice(0, 10),
      dte,
      calls: genLeg(spot, null, dte, 'call', iv, quality),
      puts: genLeg(spot, null, dte, 'put', iv, quality),
    };
  });
  return { asOf: AS_OF, expirations };
}

// ── The five symbols ──────────────────────────────────────────────────────────

export const FIXTURES = {
  // Uptrend that pulled back toward its 50DMA — classic put-selling entry.
  AMD: (() => {
    const history = genSeries({ start: 120, days: 220, drift: 0.0018, dip: 0.05 });
    const price = history[history.length - 1].close;
    return {
      symbol: 'AMD',
      asOf: AS_OF,
      price,
      prevClose: history[history.length - 2].close,
      volume: 42_000_000,
      avgVolume: 38_000_000,
      history,
      fundamentals: {
        priceToSales: 6.2,
        forwardPe: 24,
        revenueGrowthYoY: 0.22,
        grossMargin: 0.50,
        cashPerShare: 5.4,
        debtToEquity: 0.08,
        marketCap: 260_000_000_000,
      },
      shortInterest: { percentFloat: 0.03, daysToCover: 1.2 },
      earnings: { nextDate: '2026-08-19' }, // comfortably outside blackout
      ivRank: 48,
      optionChain: chain(price, 48, 0.42, 1.4),
    };
  })(),

  // Attractive on its own, but same sector as AMD — correlation cap should bite.
  MU: (() => {
    const history = genSeries({ start: 70, days: 220, drift: 0.0016, dip: 0.08 });
    const price = history[history.length - 1].close;
    return {
      symbol: 'MU',
      asOf: AS_OF,
      price,
      prevClose: history[history.length - 2].close,
      volume: 30_000_000,
      avgVolume: 26_000_000,
      history,
      fundamentals: {
        priceToSales: 3.1,
        forwardPe: 12,
        revenueGrowthYoY: 0.30,
        grossMargin: 0.35,
        cashPerShare: 7.1,
        debtToEquity: 0.28,
        marketCap: 130_000_000_000,
      },
      shortInterest: { percentFloat: 0.04, daysToCover: 1.6 },
      earnings: { nextDate: '2026-09-24' },
      ivRank: 44,
      optionChain: chain(price, 44, 0.40, 1.3),
    };
  })(),

  // Reports earnings in a few days — inside the blackout window.
  XPEV: (() => {
    const history = genSeries({ start: 15, days: 220, drift: 0.001, dip: 0.06 });
    const price = history[history.length - 1].close;
    return {
      symbol: 'XPEV',
      asOf: AS_OF,
      price,
      prevClose: history[history.length - 2].close,
      volume: 22_000_000,
      avgVolume: 20_000_000,
      history,
      fundamentals: {
        priceToSales: 2.4,
        forwardPe: -1, // unprofitable
        revenueGrowthYoY: 0.28,
        grossMargin: 0.14,
        cashPerShare: 6.0,
        debtToEquity: 0.35,
        marketCap: 15_000_000_000,
      },
      shortInterest: { percentFloat: 0.09, daysToCover: 3.1 },
      earnings: { nextDate: '2026-07-21' }, // 4 days out => blackout
      ivRank: 61,
      optionChain: chain(price, 61, 0.70, 1.2),
    };
  })(),

  // Fundamentally interesting but the option chain is too thin to trade well.
  BE: (() => {
    const history = genSeries({ start: 12, days: 220, drift: 0.0012, dip: 0.05 });
    const price = history[history.length - 1].close;
    return {
      symbol: 'BE',
      asOf: AS_OF,
      price,
      prevClose: history[history.length - 2].close,
      volume: 6_000_000,
      avgVolume: 5_200_000,
      history,
      fundamentals: {
        priceToSales: 2.0,
        forwardPe: -1,
        revenueGrowthYoY: 0.18,
        grossMargin: 0.20,
        cashPerShare: 3.2,
        debtToEquity: 0.9,
        marketCap: 4_000_000_000,
      },
      shortInterest: { percentFloat: 0.14, daysToCover: 4.0 },
      earnings: { nextDate: '2026-08-28' },
      ivRank: 55,
      optionChain: chain(price, 55, 0.65, 0.06), // quality 0.06 => tiny OI/volume
    };
  })(),

  // Richly valued and extended; we already hold 100 shares (see portfolio seed).
  EH: (() => {
    const history = genSeries({ start: 14, days: 220, drift: 0.0035, wobble: 0.03 });
    const price = history[history.length - 1].close;
    return {
      symbol: 'EH',
      asOf: AS_OF,
      price,
      prevClose: history[history.length - 2].close,
      volume: 4_500_000,
      avgVolume: 3_800_000,
      history,
      fundamentals: {
        priceToSales: 12.5, // expensive
        forwardPe: 90,
        revenueGrowthYoY: 0.35,
        grossMargin: 0.30,
        cashPerShare: 2.1,
        debtToEquity: 0.15,
        marketCap: 6_000_000_000,
      },
      shortInterest: { percentFloat: 0.11, daysToCover: 3.4 },
      earnings: { nextDate: '2026-08-26' },
      ivRank: 72,
      optionChain: chain(price, 72, 0.85, 1.1),
    };
  })(),
};

export function fixtureFor(symbol) {
  const f = FIXTURES[symbol];
  if (!f) throw new Error(`No fixture for ${symbol}`);
  // Return a deep-ish copy so downstream mutation can't leak between runs.
  return JSON.parse(JSON.stringify(f));
}

export const FIXTURE_AS_OF = AS_OF;

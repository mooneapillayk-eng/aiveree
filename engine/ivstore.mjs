// ─── IV-RANK STORE ───────────────────────────────────────────────────────────
// True IV rank = where today's implied volatility sits within its own trailing
// year. No vendor exposes that as a single number, so we accumulate it: each run
// records the at-the-money IV per symbol, and the rank is the percentile of the
// latest reading within the lookback window.
//
// Until enough samples exist (`minSamples`), there is no honest IV history to
// rank against, so callers fall back to a realized-volatility proxy — and the
// result is clearly labelled `warming_up` so a thin history never masquerades as
// a real signal.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export class IvStore {
  constructor(config) {
    this.config = config.ivStore;
    this.path = this.config.path;
    this.data = this._load();
  }

  _load() {
    if (this.path && existsSync(this.path)) {
      try {
        return JSON.parse(readFileSync(this.path, 'utf8'));
      } catch {
        /* corrupt file -> start fresh rather than crash a run */
      }
    }
    return { symbols: {} }; // { symbols: { AMD: [{date, iv}, ...] } }
  }

  save() {
    if (!this.path) return;
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.data, null, 2));
  }

  // Record one ATM IV observation (idempotent per symbol+date).
  record(symbol, date, atmIv) {
    if (atmIv == null || !Number.isFinite(atmIv)) return;
    const list = (this.data.symbols[symbol] ||= []);
    if (!list.some((r) => r.date === date)) list.push({ date, iv: round4(atmIv) });
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    // Trim to a little over the lookback window.
    const keep = this.config.lookbackDays + 20;
    if (list.length > keep) this.data.symbols[symbol] = list.slice(-keep);
  }

  // Rank today's IV (0..100) within the trailing window. Returns a labelled
  // result so callers know whether it is a real rank or a warm-up proxy input.
  rank(symbol, currentIv) {
    const list = (this.data.symbols[symbol] || []).slice(-this.config.lookbackDays);
    const ivs = list.map((r) => r.iv);
    const ref = currentIv != null && Number.isFinite(currentIv) ? currentIv : ivs[ivs.length - 1];
    if (ref == null || ivs.length < this.config.minSamples) {
      return { rank: null, samples: ivs.length, status: 'warming_up' };
    }
    const below = ivs.filter((v) => v <= ref).length;
    return { rank: Math.round((below / ivs.length) * 100), samples: ivs.length, status: 'ok' };
  }
}

// At-the-money IV from a normalised snapshot's front-month chain: average the IV
// of the call and put nearest the spot.
export function atmIvFromSnapshot(snapshot) {
  const exps = snapshot.optionChain?.expirations || [];
  if (!exps.length) return null;
  const front = exps.slice().sort((a, b) => a.dte - b.dte)[0];
  const spot = snapshot.price;
  const nearest = (legs) => {
    const withIv = (legs || []).filter((o) => o.iv != null);
    if (!withIv.length) return null;
    return withIv.slice().sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))[0].iv;
  };
  const c = nearest(front.calls);
  const p = nearest(front.puts);
  const vals = [c, p].filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const round4 = (x) => Math.round(x * 10000) / 10000;

import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG } from '../engine/config.mjs';
import { IvStore, atmIvFromSnapshot } from '../engine/ivstore.mjs';

function storeConfig(minSamples = 5) {
  const c = structuredClone(CONFIG);
  // Nonexistent temp path -> starts fresh, and we never call save().
  c.ivStore = { enabled: true, path: join(tmpdir(), `iv-test-${minSamples}-none.json`), lookbackDays: 252, minSamples };
  return c;
}

describe('IvStore', () => {
  it('reports warming_up until minSamples observations exist', () => {
    const store = new IvStore(storeConfig(5));
    for (let i = 0; i < 4; i++) store.record('AMD', `2026-01-0${i + 1}`, 0.4 + i * 0.01);
    expect(store.rank('AMD', 0.45).status).toBe('warming_up');
  });

  it('computes a true percentile rank once enough history exists', () => {
    const store = new IvStore(storeConfig(5));
    const ivs = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55];
    ivs.forEach((iv, i) => store.record('AMD', `2026-02-${String(i + 1).padStart(2, '0')}`, iv));
    // Current IV at the top of its range -> high rank.
    const high = store.rank('AMD', 0.55);
    expect(high.status).toBe('ok');
    expect(high.rank).toBeGreaterThan(80);
    // Current IV at the bottom -> low rank.
    expect(store.rank('AMD', 0.30).rank).toBeLessThan(30);
  });

  it('deduplicates observations on the same date', () => {
    const store = new IvStore(storeConfig(1));
    store.record('AMD', '2026-03-01', 0.4);
    store.record('AMD', '2026-03-01', 0.9); // ignored (same date)
    expect(store.data.symbols.AMD).toHaveLength(1);
    expect(store.data.symbols.AMD[0].iv).toBe(0.4);
  });

  it('ignores non-finite IV', () => {
    const store = new IvStore(storeConfig(1));
    store.record('AMD', '2026-03-01', null);
    store.record('AMD', '2026-03-02', NaN);
    expect(store.data.symbols.AMD).toBeUndefined();
  });
});

describe('atmIvFromSnapshot', () => {
  it('averages the call and put IV nearest the spot', () => {
    const snapshot = {
      price: 100,
      optionChain: {
        expirations: [
          {
            dte: 30,
            calls: [
              { strike: 90, iv: 0.5 },
              { strike: 100, iv: 0.4 },
              { strike: 110, iv: 0.6 },
            ],
            puts: [
              { strike: 95, iv: 0.42 },
              { strike: 100, iv: 0.44 },
            ],
          },
        ],
      },
    };
    // nearest call to 100 is strike 100 (iv 0.4), nearest put is strike 100 (0.44)
    expect(atmIvFromSnapshot(snapshot)).toBeCloseTo(0.42, 5);
  });

  it('returns null when there is no chain', () => {
    expect(atmIvFromSnapshot({ price: 100, optionChain: { expirations: [] } })).toBeNull();
  });
});

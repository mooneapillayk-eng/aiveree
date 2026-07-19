// ─── DATA PROVIDER · interface + factory ─────────────────────────────────────
// A provider returns a normalised snapshot per symbol. The rest of the engine
// only ever sees this shape, so swapping the mock provider for a live adapter
// (yfinance / Polygon / Tradier / broker feed) changes nothing downstream.
//
// Snapshot shape (see fixtures.mjs for a worked example):
//   {
//     symbol, asOf,
//     price, prevClose, volume, avgVolume,
//     history: [{ date, close, volume }...],   // oldest -> newest, >=200 rows ideal
//     fundamentals: { priceToSales, forwardPe, revenueGrowthYoY, grossMargin,
//                     cashPerShare, debtToEquity, marketCap },
//     shortInterest: { percentFloat, daysToCover },
//     earnings: { nextDate },                  // ISO 'YYYY-MM-DD' or null
//     ivRank,                                   // 0-100, IV percentile over ~1y
//     optionChain: { asOf, expirations: [ { expiry, dte,
//                     calls: [opt...], puts: [opt...] } ] }
//   }
// where opt = { strike, bid, ask, iv, openInterest, volume, delta }
// (delta is signed: calls positive, puts negative)

import { MockProvider } from './mockProvider.mjs';

export function createProvider(config) {
  switch (config.dataProvider) {
    case 'mock':
      return new MockProvider(config);
    case 'live':
      // Drop-in point for a real feed. Intentionally not wired: paper engine
      // ships offline-first. Implement fetchSnapshot(symbol, asOf) returning the
      // shape above and register it here.
      throw new Error(
        "Live data provider not configured. Set ENGINE_DATA_PROVIDER=mock or implement a live adapter in engine/data/."
      );
    default:
      throw new Error(`Unknown data provider: ${config.dataProvider}`);
  }
}

// Small helper shared by providers: mid price of an option quote.
export function mid(opt) {
  return (opt.bid + opt.ask) / 2;
}

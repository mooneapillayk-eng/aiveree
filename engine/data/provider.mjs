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
//
// Optional discovery interface (used by the screener to find NEW candidates):
//   provider.supportsDiscovery: boolean          // false => screener stays dormant
//   provider.listCandidates(): Promise<string[]> // broad ticker list to screen
// The mock provider does not implement discovery (offline fixtures only).

import { MockProvider } from './mockProvider.mjs';
import { LiveProvider } from './liveProvider.mjs';
import { PolygonProvider } from './polygonProvider.mjs';

export function createProvider(config) {
  switch (config.dataProvider) {
    case 'mock':
      return new MockProvider(config);
    case 'live':
      // Live Yahoo Finance feed (no API key). Requires outbound network access
      // to query1.finance.yahoo.com. Still paper trading — execution simulates
      // fills; only the market data is live.
      return new LiveProvider(config);
    case 'polygon':
      // Polygon.io / Massive feed (POLYGON_API_KEY). Real vendor greeks + IV.
      return new PolygonProvider(config);
    default:
      throw new Error(`Unknown data provider: ${config.dataProvider}`);
  }
}

// Small helper shared by providers: mid price of an option quote.
export function mid(opt) {
  return (opt.bid + opt.ask) / 2;
}

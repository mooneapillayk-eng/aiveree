// ─── MOCK DATA PROVIDER ──────────────────────────────────────────────────────
// Serves the deterministic fixtures. Offline, no API keys, reproducible.

import { fixtureFor, FIXTURE_AS_OF } from './fixtures.mjs';

export class MockProvider {
  constructor(config) {
    this.config = config;
    this.name = 'mock';
    this.asOf = FIXTURE_AS_OF;
    // Offline fixtures only — no broad market list to discover from. This keeps
    // the screener dormant in mock mode (see engine/screener.mjs).
    this.supportsDiscovery = false;
  }

  // Returns the normalised snapshot documented in provider.mjs.
  async fetchSnapshot(symbol) {
    return fixtureFor(symbol);
  }
}

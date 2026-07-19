// ─── PORTFOLIO LEDGER ────────────────────────────────────────────────────────
// A boring, transparent JSON file store for the paper account: cash, open option
// positions, share holdings, filled orders, and a decision log. No database, no
// network — everything is a plain file you can open and read.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export class Portfolio {
  constructor(state, path, config) {
    this.state = state;
    this.path = path;
    this.config = config;
  }

  static load(config) {
    const path = config.statePath;
    if (existsSync(path)) {
      const state = JSON.parse(readFileSync(path, 'utf8'));
      return new Portfolio(state, path, config);
    }
    // Fresh account. Seed 100 shares of EH so the covered-call path is live.
    const state = {
      createdAt: null, // stamped by the caller/run, not here (keeps this pure)
      cash: config.account.startingCash,
      startingCash: config.account.startingCash,
      currency: config.account.currency,
      holdings: { EH: 100 }, // seeded paper share position
      positions: [], // open option structures
      orders: [], // every order we (paper-)placed
      decisions: [], // full decision log incl. no-trades
      realizedPnl: 0,
      seq: 0,
    };
    return new Portfolio(state, path, config);
  }

  save() {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.state, null, 2));
  }

  // ── Views the risk engine relies on ─────────────────────────────────────────
  get cash() {
    return this.state.cash;
  }
  equity() {
    // Paper equity = cash on hand. Cash-secured collateral is still cash we own;
    // it is merely earmarked (see committedCollateral / availableCash).
    return round2(this.state.cash);
  }
  openPositions() {
    return this.state.positions.filter((p) => p.status === 'open');
  }
  committedCollateral() {
    return round2(this.openPositions().reduce((a, p) => a + (p.collateral || 0), 0));
  }
  sharesOwned(symbol) {
    return this.state.holdings[symbol] || 0;
  }

  nextId(prefix) {
    this.state.seq += 1;
    return `${prefix}-${String(this.state.seq).padStart(4, '0')}`;
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
  recordDecision(entry) {
    this.state.decisions.push(entry);
  }

  openPosition({ structure, contracts, order }) {
    const id = this.nextId('POS');
    const credit = (structure.creditPerContract || 0) * contracts;
    const collateral = (structure.collateralPerContract || 0) * contracts;
    this.state.cash = round2(this.state.cash + credit); // premium received
    this.state.positions.push({
      id,
      orderId: order.id,
      symbol: structure.symbol,
      sector: this.config.sectors[structure.symbol] || 'unknown',
      type: structure.type,
      contracts,
      expiry: structure.expiry,
      legs: structure.legs,
      creditReceived: round2(credit),
      collateral: round2(collateral),
      maxLoss: round2((structure.maxLossPerContract || 0) * contracts),
      breakeven: structure.breakeven,
      openedAsOf: structure.asOf || null,
      status: 'open',
    });
    return id;
  }
}

const round2 = (x) => Math.round(x * 100) / 100;

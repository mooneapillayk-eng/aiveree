#!/usr/bin/env node
// ─── CLI ENTRY ───────────────────────────────────────────────────────────────
// Run a paper cycle across the universe.
//
//   node engine/cli.mjs                 # run, print report to console
//   node engine/cli.mjs --verbose       # also print per-symbol reasoning
//   node engine/cli.mjs --symbols=AMD,MU
//   node engine/cli.mjs --no-notify     # skip Telegram even if configured
//   node engine/cli.mjs --dry-run       # do NOT write the ledger
//   node engine/cli.mjs --reset         # start from a fresh paper account
//
// Telegram: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to deliver to a chat;
// otherwise the report prints to the console.

import { existsSync, rmSync } from 'node:fs';
import { CONFIG } from './config.mjs';
import { Portfolio } from './portfolio.mjs';
import { runCycle } from './run.mjs';

function parseArgs(argv) {
  const opts = { verbose: false, notify: true, persist: true, reset: false, symbols: null, provider: null };
  for (const arg of argv.slice(2)) {
    if (arg === '--verbose' || arg === '-v') opts.verbose = true;
    else if (arg === '--no-notify') opts.notify = false;
    else if (arg === '--dry-run') opts.persist = false;
    else if (arg === '--reset') opts.reset = true;
    else if (arg === '--live') opts.provider = 'live';
    else if (arg.startsWith('--provider=')) opts.provider = arg.split('=')[1].trim();
    else if (arg.startsWith('--symbols=')) opts.symbols = arg.split('=')[1].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      process.exit(1);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`Options paper-trading engine

Usage: node engine/cli.mjs [options]
  --verbose, -v       Print per-symbol reasoning
  --symbols=A,B,C     Override the universe
  --provider=mock|live|polygon  Data source (mock=offline, live=Yahoo, polygon=Polygon.io)
  --live              Shorthand for --provider=live
  --no-notify         Skip Telegram delivery (console only)
  --dry-run           Do not persist the ledger
  --reset             Reset to a fresh paper account before running
  --help, -h          Show this help`);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.provider) CONFIG.dataProvider = opts.provider;

  if (opts.reset && existsSync(CONFIG.statePath)) {
    rmSync(CONFIG.statePath);
    console.log(`Reset: removed ${CONFIG.statePath}`);
  }

  const portfolio = Portfolio.load(CONFIG);
  if (!portfolio.state.createdAt) portfolio.state.createdAt = new Date().toISOString();

  const { delivery } = await runCycle(CONFIG, {
    symbols: opts.symbols,
    verbose: opts.verbose,
    notify: opts.notify,
    persist: opts.persist,
    portfolio,
  });

  if (delivery) {
    console.log(`\n[delivered via ${delivery.delivered}${delivery.ok ? '' : ' — with errors'}]`);
  }
}

main().catch((err) => {
  const msg = String(err?.message || err);
  const networkish = /finance\.yahoo\.com|api\.polygon\.io|fetch failed|ENOTFOUND|ECONNREFUSED|HTTP 40[37]|getcrumb/i.test(msg);
  if (/POLYGON_API_KEY/.test(msg)) {
    console.error('Polygon provider needs an API key.');
    console.error(
      '\nSet POLYGON_API_KEY from your Polygon.io ("Massive") account — the $29/mo\n' +
        'Options Starter tier is sufficient (real greeks + IV, 2y history):\n' +
        '  export POLYGON_API_KEY=your_key_here\n' +
        'Or use `--provider=mock` (offline) / `--provider=live` (Yahoo, no key).'
    );
  } else if ((CONFIG.dataProvider === 'live' || CONFIG.dataProvider === 'polygon') && networkish) {
    console.error('Live data fetch failed:', msg);
    console.error(
      `\nThe ${CONFIG.dataProvider} provider needs outbound HTTPS to its data host.\n` +
        'A 403/407 here means an egress policy is blocking that host (common in sandboxes).\n' +
        'Run it from a network where the host is reachable, or switch back with\n' +
        '`--provider=mock` for the offline deterministic engine.'
    );
  } else {
    console.error('Engine run failed:', err);
  }
  process.exit(1);
});

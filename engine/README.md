# Options Paper-Trading Engine

A **simple, boring, transparent, and robust** decision engine for selling
options premium on a small universe of stocks. It is **paper-only** — there is no
broker connectivity and no real money is ever at risk. Fills are simulated
deterministically so a run is fully reproducible.

The goal is **not** to predict every market move. The goal is to systematically
identify potentially attractive opportunities, **reject poor trades**, size
acceptable trades **conservatively**, and manage risk correctly. Every decision —
including "no trade" — is explained with the numbers behind it.

## Pipeline

```
Universe (+ screener) -> Data -> [Valuation | Technical | Positioning]
         -> Opportunity engine -> Risk engine -> Strategy selector
         -> Execution (paper) -> Ledger -> Reporter (Telegram/console)
```

| Stage | Module | Responsibility |
|-------|--------|----------------|
| Universe & config | `config.mjs` | Symbols, thresholds, risk limits, sector map |
| Screener (discovery) | `screener.mjs` | Finds & ranks NEW candidates beyond the fixed universe; dormant on the mock feed (needs live data) |
| Data collection | `data/provider.mjs`, `data/mockProvider.mjs`, `data/fixtures.mjs` | Normalised per-symbol snapshot (price/volume, fundamentals, short interest, option chain, earnings, IV) |
| Valuation lens | `analysis/valuation.mjs` | Cheap/expensive from P/S, growth, cash, leverage |
| Technical lens | `analysis/technical.mjs` | 50/200 DMA, trend, Fibonacci retracement, pullback-to-support |
| Positioning lens | `analysis/positioning.mjs` | Short interest, put/call OI, IV rank |
| Opportunity engine | `opportunity.mjs` | Fuses the three lenses -> bias, conviction, intent; hard event gate (earnings blackout, IV floor) |
| Risk engine | `risk.mjs` | Position sizing, per-name & portfolio exposure caps, correlation cap, concurrency, **veto power** |
| Strategy selector | `strategy.mjs` | Cash-secured put / put credit spread / covered call / **no trade** + concrete strikes & expiry |
| Execution | `execution.mjs` | Limit order, deterministic fill model, reconciliation |
| Ledger | `portfolio.mjs` | JSON paper account: cash, positions, orders, decision log |
| Reporter | `reporter.mjs` | Telegram delivery (console fallback), incl. no-trade output |
| Orchestrator | `run.mjs`, `cli.mjs` | One cycle across the universe |

## Running paper trading

No API keys or database are required — the mock provider serves deterministic
fixtures offline.

```bash
npm install            # once
npm run engine         # run a cycle, print the report to the console
npm run engine:verbose # + per-symbol reasoning for every lens
npm run engine:reset   # start from a fresh paper account, then run

# direct CLI with options
node engine/cli.mjs --symbols=AMD,MU --verbose --dry-run
node engine/cli.mjs --no-notify        # console only, never call Telegram
node engine/cli.mjs --dry-run          # do not write the ledger
node engine/cli.mjs --reset            # wipe the ledger and start clean
```

The paper account and every decision are stored in `engine/state/portfolio.json`
(git-ignored). Each run appends to the decision log and opens any approved
positions. Use `--dry-run` to evaluate without mutating the ledger.

### Telegram delivery

Set two environment variables to deliver the run summary to a Telegram chat:

```bash
export TELEGRAM_BOT_TOKEN=123456:ABC...
export TELEGRAM_CHAT_ID=987654321
npm run engine
```

With no token/chat configured the report simply prints to the console, so the
engine is fully usable with zero secrets.

## Candidate discovery (screener)

The engine analyses the fixed universe **plus any watchlist** you pass
(`config.universe`, or `--symbols=NVDA,SOFI,PLTR`). On top of that, a **screener**
(`screener.mjs`) can discover *new* names automatically: it scores a broad
candidate list with the same lenses used to trade (elevated IV rank, supportive
short interest / positioning, reasonable valuation, constructive technicals — and
never inside an earnings blackout) and promotes the top `maxNewCandidates` that
clear `minScreenScore` into the run.

The screener is **dormant by design** until a live data provider is wired,
because scanning a broad market list needs a real feed — the mock provider
serves offline fixtures only. A live provider opts in by exposing
`supportsDiscovery = true` and `listCandidates()` (see `data/provider.mjs`).
Until then, the report simply prints `discovery: dormant (...)` and analyses the
explicit universe. Tune it under `screener` in `config.mjs`.

## Swapping in live data

The engine only ever sees the normalised snapshot documented at the top of
`data/provider.mjs`. To go from paper-with-mock-data to paper-with-live-data,
implement a provider with `fetchSnapshot(symbol)` returning that shape (from
yfinance / Polygon / Tradier / a broker feed), register it in
`createProvider()`, and set `ENGINE_DATA_PROVIDER=live`. Nothing downstream
changes. This remains paper trading — the execution engine still simulates fills.

## Design guarantees

- **Deterministic** — same data + same config + same starting ledger => same
  decisions and the same report, byte for byte (covered by a test).
- **Conservative** — the risk engine can only ever shrink or block a trade.
- **Transparent** — every trade and every rejection carries its reasons and
  numbers. "No trade" is a first-class output, never silence.
- **No hidden dependencies** — pure JavaScript, no npm packages beyond what the
  repo already had; built-in `fetch` for Telegram; a plain JSON ledger.

## Known limitations

See the "Known limitations" section of the top-level change summary. In short:
mock data is illustrative not live; the fill model is a simplification; there is
no position *management* loop yet (open-only); and greeks are approximated.

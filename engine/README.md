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
| Data collection | `data/provider.mjs`, `data/mockProvider.mjs`, `data/liveProvider.mjs`, `data/fixtures.mjs` | Normalised per-symbol snapshot (price/volume, fundamentals, short interest, option chain, earnings, IV) — mock (offline) or live (Yahoo) |
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

## Live data (Yahoo Finance, no API key)

A live provider (`data/liveProvider.mjs`) sources the normalised snapshot from
Yahoo Finance — the same keyless endpoints `yfinance` uses. Run it with:

```bash
npm run engine:live                       # live data, full universe + discovery
node engine/cli.mjs --live --symbols=AMD,MU,NVDA --verbose
ENGINE_DATA_PROVIDER=live node engine/cli.mjs
```

It remains **paper trading** — only the market data is live; the execution
engine still simulates fills. What it pulls per symbol:

| Field | Yahoo endpoint |
|-------|----------------|
| Price + 1y history (DMAs, IV-rank proxy) | `v8/finance/chart` |
| Option chain (bid/ask/IV/OI/volume) | `v7/finance/options` |
| Fundamentals, short interest, earnings date | `v10/finance/quoteSummary` (cookie+crumb) |

Because Yahoo returns **no option greeks**, deltas are computed with
Black-Scholes from each contract's implied volatility (`bsDelta`, risk-free rate
in `config.live`). Because Yahoo exposes **no historical IV**, `ivRank` is a
realized-volatility percentile **proxy** (`computeIvRankProxy`). Fundamentals,
short interest and earnings are **best-effort**: if the crumb-gated call fails,
the snapshot still returns and the lenses tolerate the missing fields.

With live data on, the **screener wakes up**: `listCandidates()` returns
`config.live.candidateList`, and the top names clearing `minScreenScore` are
promoted into the run automatically.

> **Network requirement.** The live provider needs outbound HTTPS to
> `query1.finance.yahoo.com`. In locked-down sandboxes an egress policy may
> return `403/407` for that host — the CLI detects this and prints how to
> proceed. Run it from a network where Yahoo is reachable, or use
> `--provider=mock` for the offline engine.

### Adding a different vendor (Polygon / Tradier / broker)

The engine only ever sees the snapshot documented at the top of
`data/provider.mjs`. To use another feed, implement a class with
`fetchSnapshot(symbol)` (and, for discovery, `supportsDiscovery = true` +
`listCandidates()`), register it in `createProvider()`, and select it with
`--provider=<name>` / `ENGINE_DATA_PROVIDER`. Nothing downstream changes.

## Design guarantees

- **Deterministic** — same data + same config + same starting ledger => same
  decisions and the same report, byte for byte (covered by a test).
- **Conservative** — the risk engine can only ever shrink or block a trade.
- **Transparent** — every trade and every rejection carries its reasons and
  numbers. "No trade" is a first-class output, never silence.
- **No hidden dependencies** — pure JavaScript, no npm packages beyond what the
  repo already had; built-in `fetch` for Telegram; a plain JSON ledger.

## Known limitations

- **Live mode needs network egress** to Yahoo; blocked hosts fail cleanly with a
  hint (see above).
- **IV rank is a proxy** (realized-vol percentile) — Yahoo exposes no historical
  IV. A vendor that provides real IV rank would drop straight in.
- **Greeks are computed**, not vendor-supplied (Black-Scholes from IV).
- **Fundamentals/short-interest are best-effort** on the free Yahoo feed and can
  be sparse for some tickers; the engine degrades gracefully.
- The **fill model is a simplification** (mid when tight, conservative when wide;
  no partial fills / slippage curve).
- **Open-only**: there is no position *management* loop yet (roll/close/assignment).
- Mock mode is deterministic and illustrative — good for tests and demos, not a
  market forecast.

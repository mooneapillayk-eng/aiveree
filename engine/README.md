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
| Data collection | `data/provider.mjs`, `data/mockProvider.mjs`, `data/liveProvider.mjs`, `data/polygonProvider.mjs`, `data/fixtures.mjs` | Normalised per-symbol snapshot — mock (offline), live (Yahoo, no key), or polygon (real greeks + IV) |
| IV-rank store | `ivstore.mjs` | Accumulates ATM IV to compute a true 52-week IV rank; realized-vol proxy while warming up |
| Valuation lens | `analysis/valuation.mjs` | Cheap/expensive from P/S, growth, cash, leverage |
| Technical lens | `analysis/technical.mjs` | 50/200 DMA, trend, Fibonacci retracement, pullback-to-support |
| Positioning lens | `analysis/positioning.mjs` | Short interest, put/call OI, IV rank |
| Opportunity engine | `opportunity.mjs` | Fuses the three lenses -> bias, conviction, intent; hard event gate (earnings blackout, IV floor) |
| Position management | `manage.mjs` | Exits open positions before entries: profit target, stop, DTE cutoff, **roll-for-credit**, and expiration settlement (assignment / called-away) |
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

## Position management (entries *and* exits)

Each cycle **manages open positions before opening new ones** (`manage.mjs`), so
freed capital is available to entries. Short premium is marked to a Black-Scholes
model value (spot + IV + time), then:

- **Profit target** — buy-to-close once `profitTargetPct` of the credit is captured (default 50%).
- **Stop loss** — close once the loss reaches `stopLossMultiple` × credit (default 2×).
- **DTE exit / roll** — at `dteExit` days to expiry (default 21), **roll** the position out in time when rolling is enabled and it nets a credit (close the near leg + open a same-structure, further-dated one); otherwise just close. Two guardrails: a roll that would cost a debit falls back to a plain close, and a roll that would extend the position **across its next earnings report** also falls back to a close (`management.roll.avoidEarnings`) — so the engine never carries a short option through an earnings print, matching the entry blackout.
- **Expiration settlement** — intrinsics settle, including **assignment** (a cash-secured put finishing ITM puts 100 shares/contract to you) and **shares called away** (an ITM covered call). Put spreads settle to their bounded net intrinsic.

Realised P&L is booked to the ledger (`realizedPnl`) and shown in the report; the
run's `EXITS` section lists each close with its reason and P&L. Tune under
`management` in `config.mjs`. This is still paper — closes are modelled, not sent
to a broker.

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

## Polygon.io provider (real greeks + true IV rank)

For production use, the **Polygon** provider (`data/polygonProvider.mjs`) pulls
**vendor greeks and implied volatility** — no Black-Scholes approximation — plus
fundamentals and short interest. Set a key and go:

```bash
export POLYGON_API_KEY=your_key
npm run engine:polygon
node engine/cli.mjs --provider=polygon --symbols=AMD,MU,NVDA -v
```

The **Options Starter tier ($29/mo) is sufficient**: 15-minute-delayed prices are
fine for a once-a-day paper engine, and it ships real greeks + IV with 2 years of
history. Real-time ($199) only buys live intraday prices this engine doesn't use.

**True IV rank.** No vendor exposes a 52-week IV *rank* as one field, so the
engine keeps its own: on every run it records each symbol's at-the-money IV
(`engine/state/iv-history.json`) and computes the rank as a percentile over the
trailing year (`ivStore` in config). Until `minSamples` accumulate it falls back
to a realized-volatility proxy — and the report says so per symbol
(`IV rank source: realized-vol proxy (warming up: 12/40)` →
`IV rank source: iv-store (63 samples)`). This overlay also refines the Yahoo
provider's IV rank over time. The mock provider is never touched (stays
deterministic).

**Earnings blackout stays real.** Polygon's cheap tiers ship no earnings
calendar, so the blackout gate can read next-earnings dates from a JSON file at
`engine/state/earnings.json` (or `ENGINE_EARNINGS_PATH`):

```json
{ "AMD": "2026-08-19", "MU": "2026-09-24", "NVDA": "2026-08-27" }
```

When present it overrides/supplies `earnings.nextDate` for live providers.

> **Verify one endpoint for your plan:** the short-interest path
> (`/v3/reference/short-interest`) varies by Polygon plan; the code is null-safe
> if your plan doesn't include it, and the positioning lens degrades gracefully.

### Backfill: real IV rank on day one

To skip the warm-up, seed the IV-history store with real historical IV before the
first run:

```bash
export POLYGON_API_KEY=your_key
npm run engine:backfill                       # core universe, ~1y, weekly samples
node engine/backfill-iv.mjs --symbols=AMD,MU,NVDA --weekly=5 --lookback=365
```

Polygon has no historical-IV series, so the script reconstructs it: for each past
sampling date it pulls the near-ATM monthly option's daily close (option
aggregates) and **inverts Black-Scholes** to recover that day's IV
(`engine/backfill-iv.mjs`). Weekly sampling over a year yields ~52 points per
symbol — above the `minSamples` floor — so IV rank reads `iv-store` immediately.
It's idempotent (the store dedupes by date) and only writes the IV-history file.
Strikes are rounded to standard increments and ATM-IV is insensitive to being off
by one strike, so the reconstruction is a faithful approximation.

### Adding yet another vendor (Tradier / broker)

The engine only ever sees the snapshot documented at the top of
`data/provider.mjs`. To use another feed, implement a class with
`fetchSnapshot(symbol)` (optionally `supportsDiscovery`, `usesIvStore`,
`usesEarningsOverride`), register it in `createProvider()`, and select it with
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

- **Live modes need network egress** to their data host; blocked hosts fail
  cleanly with a hint (see above).
- **IV rank** is real once the IV-history store has warmed up; before that it is a
  realized-vol proxy (labelled in the report). Back-history isn't fetched
  automatically — it accumulates one run per day, or you can backfill the store.
- **Greeks:** vendor-supplied on Polygon; Black-Scholes-computed on Yahoo.
- **Fundamentals/short-interest are best-effort** on both live feeds and can be
  sparse for some tickers; the engine degrades gracefully. Verify the Polygon
  short-interest endpoint for your plan.
- **Earnings dates** on Polygon come from the optional calendar file, not the
  vendor.
- The **fill model is a simplification** (mid when tight, conservative when wide;
  no partial fills / slippage curve). Open positions are **marked to a
  Black-Scholes model value** for management, not to a live close quote.
- Rolls are executed as a **close + a fresh further-dated open in the same
  cycle**, only for a net credit; defensive rolls that would require a debit fall
  back to a plain close.
- Mock mode is deterministic and illustrative — good for tests and demos, not a
  market forecast.

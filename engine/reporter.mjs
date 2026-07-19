// ─── REPORTER ────────────────────────────────────────────────────────────────
// Formats a run into a human-readable report and delivers it to Telegram. When
// no bot token / chat id are configured it prints to the console instead, so the
// engine is fully usable with zero secrets. Messages are plain text (no fragile
// MarkdownV2 escaping) for robustness.

export function formatRunReport(report) {
  const lines = [];
  lines.push(`OPTIONS ENGINE — paper run`);
  lines.push(`as of ${report.asOf} · provider: ${report.provider}`);
  lines.push(`universe: ${report.universe.join(' ')}`);
  lines.push(formatDiscovery(report.screener));
  lines.push('');

  if (report.trades.length) {
    lines.push(`✅ TRADES (${report.trades.length})`);
    for (const t of report.trades) lines.push(...formatTrade(t));
  } else {
    lines.push(`✅ TRADES (0) — nothing cleared the bar this run.`);
  }
  lines.push('');

  lines.push(`⛔ NO TRADE (${report.noTrades.length})`);
  for (const n of report.noTrades) {
    lines.push(`• ${n.symbol}: ${n.reason}`);
  }
  lines.push('');

  const a = report.account;
  lines.push(`— ACCOUNT —`);
  lines.push(`cash: $${fmt(a.cashAfter)}  (credit collected this run: $${fmt(a.creditThisRun)})`);
  lines.push(`open positions: ${a.openPositions}  ·  committed collateral: $${fmt(a.committedAfter)}`);
  lines.push(`portfolio exposure: ${pct(a.committedAfter / a.startingCash)} of cap ${pct(report.caps.portfolio)}`);

  if (report.reconciliation.some((r) => !r.ok)) {
    lines.push('');
    lines.push(`⚠️ RECONCILIATION ISSUES`);
    for (const r of report.reconciliation.filter((x) => !x.ok)) {
      lines.push(`• ${r.symbol}: ${r.problems.join(' ')}`);
    }
  }

  return lines.join('\n');
}

function formatDiscovery(screen) {
  if (!screen) return 'discovery: n/a';
  if (screen.dormant) return `discovery: dormant (${screen.reason})`;
  if (!screen.promoted.length) return `discovery: scanned ${screen.considered} candidates — none cleared the screen`;
  const names = screen.promoted.map((p) => `${p.symbol}(${p.score})`).join(' ');
  return `discovery: promoted ${screen.promoted.length} of ${screen.considered} — ${names}`;
}

function formatTrade(t) {
  const s = t.structure;
  const r = t.risk;
  const out = [];
  out.push('');
  out.push(`▶ ${t.symbol} — ${label(s.type)}  [${r.contracts}x]`);
  out.push(`   ${s.reason}`);
  out.push(
    `   credit: $${fmt(t.fill.fillCreditTotal)}  ·  max loss: $${fmt(r.totalMaxLoss)}  ·  collateral: $${fmt(r.totalCollateral)}`
  );
  out.push(
    `   bias ${t.opportunity.bias} · conviction ${t.opportunity.conviction} · IVrank ${t.opportunity.lenses.positioning.ivRank} · breakeven ${s.breakeven}`
  );
  out.push(`   fill: ${t.fill.fillModel} @ ${t.fill.fillCreditPerShare}/sh · binding cap: ${r.binding}`);
  return out;
}

function label(type) {
  return (
    {
      cash_secured_put: 'Cash-Secured Put',
      put_spread: 'Put Credit Spread',
      covered_call: 'Covered Call',
    }[type] || type
  );
}

// Verbose per-symbol reasoning for the console / log (not the Telegram summary).
export function formatVerbose(decision) {
  const o = decision.opportunity;
  const lines = [];
  lines.push(`── ${decision.symbol} ─ ${decision.action}`);
  lines.push(`   composite ${o.composite} · bias ${o.bias} · conviction ${o.conviction} · intent ${o.intent}`);
  for (const lens of ['valuation', 'technical', 'positioning']) {
    const L = o.lenses[lens];
    lines.push(`   ${lens} (${L.score}): ${L.reasons.join(' ')}`);
  }
  for (const note of o.notes) lines.push(`   note: ${note}`);
  if (decision.action === 'NO_TRADE') lines.push(`   => NO TRADE: ${decision.reason}`);
  else lines.push(`   => TRADE: ${decision.structure.reason} [${decision.risk.contracts}x]`);
  return lines.join('\n');
}

// Delivery. Returns { delivered: 'telegram'|'console', ok }.
export async function deliver(text, config) {
  const { botToken, chatId } = config.telegram;
  if (botToken && chatId) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`Telegram send failed (${res.status}): ${body}`);
        console.log('\n' + text + '\n');
        return { delivered: 'console', ok: false };
      }
      return { delivered: 'telegram', ok: true };
    } catch (err) {
      console.error(`Telegram send error: ${err.message}`);
      console.log('\n' + text + '\n');
      return { delivered: 'console', ok: false };
    }
  }
  // No credentials — console fallback.
  console.log('\n' + text + '\n');
  return { delivered: 'console', ok: true };
}

const fmt = (x) => Number(x || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (x) => `${((x || 0) * 100).toFixed(0)}%`;

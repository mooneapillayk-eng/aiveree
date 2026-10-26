// ─── CLOUD BROWSER (per-run) ──────────────────────────────────────────────────
// In production each run gets its own isolated cloud browser (Browserbase), with
// a live-view URL so the user can take over to log in, then hand control back.
// If no provider is configured, returns null and the orchestrator falls back to
// a local Chromium (fine for dev; no live takeover).
//
// Endpoints used (Browserbase v1) — isolated here so a provider change is a
// one-file edit:
//   POST /v1/sessions            -> { id, connectUrl }
//   GET  /v1/sessions/:id/debug  -> { debuggerFullscreenUrl }

async function createCloudBrowser() {
  const key = process.env.BROWSERBASE_API_KEY;
  const project = process.env.BROWSERBASE_PROJECT_ID;
  if (!key || !project) return null;

  const res = await fetch('https://api.browserbase.com/v1/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-BB-API-Key': key },
    body: JSON.stringify({ projectId: project, browserSettings: { viewport: { width: 1280, height: 800 } } }),
  });
  if (!res.ok) throw new Error(`browserbase session ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const s = await res.json();

  let liveUrl = null;
  try {
    const d = await fetch(`https://api.browserbase.com/v1/sessions/${s.id}/debug`, { headers: { 'X-BB-API-Key': key } });
    if (d.ok) { const dj = await d.json(); liveUrl = dj.debuggerFullscreenUrl || dj.debuggerUrl || null; }
  } catch { /* live view is optional; takeover still works via the provider dashboard */ }

  return { wsUrl: s.connectUrl, liveUrl, sessionId: s.id };
}

module.exports = { createCloudBrowser };

// ─── AIVEREE AGENT SERVICE (HTTP) ─────────────────────────────────────────────
// The long-running service the Aiveree app talks to. Netlify functions are too
// short-lived to hold a browser, so this runs on a persistent host (Fly.io).
// Plain Node http — no framework, minimal deps.
//
//   POST /start   {run_id, user_id, task, start_url}   -> begins a run
//   POST /resume  {run_id, note}                        -> continues after a checkpoint
//   GET  /status?run_id=...                             -> run row + step log
//   GET  /health                                        -> {ok:true}
//
// Auth: every call must carry  x-internal-secret: $INTERNAL_SECRET  (the Aiveree
// Netlify function adds it). If INTERNAL_SECRET is unset the service refuses to
// start, so it can never run wide open by accident.

const http = require('http');
const { makeStore } = require('./store');
const { startRun, resumeRun, cancelRun } = require('./orchestrator');

const SECRET = process.env.INTERNAL_SECRET;
const PORT = process.env.PORT || 8080;
const store = makeStore();

function send(res, code, body) {
  const s = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) });
  res.end(s);
}

function readBody(req) {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c) => { d += c; if (d.length > 1e6) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, store: store.kind });

    // Auth on everything else.
    if (!SECRET || req.headers['x-internal-secret'] !== SECRET) return send(res, 401, { error: 'unauthorised' });

    if (req.method === 'POST' && url.pathname === '/start') {
      const b = await readBody(req);
      if (!b.task) return send(res, 400, { error: 'task required' });
      const run_id = b.run_id || `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const out = await startRun({ store, run_id, user_id: b.user_id || null, task: b.task, start_url: b.start_url || 'https://www.google.com' });
      return send(res, 200, out);
    }

    if (req.method === 'POST' && url.pathname === '/resume') {
      const b = await readBody(req);
      if (!b.run_id) return send(res, 400, { error: 'run_id required' });
      const out = await resumeRun({ store, run_id: b.run_id, note: b.note || 'Approved' });
      return send(res, out.error ? 409 : 200, out);
    }

    if (req.method === 'POST' && url.pathname === '/cancel') {
      const b = await readBody(req);
      if (!b.run_id) return send(res, 400, { error: 'run_id required' });
      return send(res, 200, await cancelRun({ store, run_id: b.run_id }));
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      const id = url.searchParams.get('run_id');
      if (!id) return send(res, 400, { error: 'run_id required' });
      const run = await store.getRun(id);
      if (!run) return send(res, 404, { error: 'not found' });
      const steps = await store.listSteps(id);
      return send(res, 200, { run, steps });
    }

    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 500, { error: String((e && e.message) || e) });
  }
});

if (require.main === module) {
  if (!SECRET) { console.error('Refusing to start: set INTERNAL_SECRET.'); process.exit(1); }
  server.listen(PORT, () => console.log(`Aiveree agent service on :${PORT} (store: ${store.kind})`));
}

module.exports = { server };

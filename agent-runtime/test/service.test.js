// HTTP contract test for the service: health, auth, and input validation.
// (The full run-through is covered by integration.js with the real browser.)

process.env.INTERNAL_SECRET = 'test-secret';
const { server } = require('../service');

function req(port, method, path, headers, body) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}
function assert(c, m) { if (!c) throw new Error('ASSERT FAILED: ' + m); }

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    let res = await req(port, 'GET', '/health');
    assert(res.status === 200, 'health 200');
    console.log('  ✓ /health ok');

    res = await req(port, 'POST', '/start', {}, { task: 'x' });
    assert(res.status === 401, 'rejects without internal secret');
    console.log('  ✓ /start without secret -> 401');

    res = await req(port, 'POST', '/start', { 'x-internal-secret': 'test-secret' }, {});
    assert(res.status === 400, 'rejects missing task');
    console.log('  ✓ /start without task -> 400');

    res = await req(port, 'GET', '/status?run_id=nope', { 'x-internal-secret': 'test-secret' });
    assert(res.status === 404, 'unknown run -> 404');
    console.log('  ✓ /status unknown run -> 404');

    console.log('\nPASS — service HTTP contract (health, auth, validation) verified.');
    process.exit(0);
  } catch (e) {
    console.error('\nFAIL —', e.message);
    process.exit(1);
  } finally {
    server.close();
  }
})();

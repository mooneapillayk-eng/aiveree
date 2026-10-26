// Smoke test: prove Aiveree can drive a real browser here — launch Chromium,
// navigate, read the page, and capture a screenshot. No Claude, no network
// beyond the page load. This verifies the hardest primitive works.

const fs = require('fs');
const path = require('path');
const { Browser } = require('./browser');

(async () => {
  const b = new Browser();
  try {
    await b.start({ headless: true });
    const url = await b.goto('https://example.com');
    const title = await b.title();
    const text = (await b.text()).slice(0, 120).replace(/\s+/g, ' ');
    const shot = await b.screenshot();
    const out = path.join(__dirname, 'smoke-screenshot.png');
    fs.writeFileSync(out, Buffer.from(shot, 'base64'));
    console.log('OK  url   :', url);
    console.log('OK  title :', title);
    console.log('OK  text  :', text);
    console.log('OK  shot  :', `${Math.round(shot.length / 1024)} KB base64 ->`, out);
    console.log('\nBrowser action layer works. Aiveree can drive a real browser.');
  } catch (e) {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    await b.close();
  }
})();

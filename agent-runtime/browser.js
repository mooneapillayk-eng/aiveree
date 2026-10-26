// ─── AIVEREE BROWSER ACTION LAYER ─────────────────────────────────────────────
// The low-level "hands": a real Chromium browser the agent drives, with exactly
// the primitive actions a computer-use model emits (screenshot, click, type,
// scroll, key, navigate). No per-app APIs — it operates the live UI like a
// person. Runs on local Chromium here; in production it points at a hosted
// cloud browser (Browserbase/Steel) via CHROMIUM_WS instead.

const fs = require('fs');
const { chromium } = require('playwright');

// Resolve which Chromium to launch:
//  • CHROMIUM_PATH if set (explicit override)
//  • the pre-provisioned binary at /opt/pw-browsers (this dev/cloud box)
//  • otherwise let Playwright use the browser bundled with its image (Docker)
function resolveExecutable() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  try { if (fs.existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium'; } catch {}
  return undefined; // Playwright finds its own
}
const EXECUTABLE = resolveExecutable();

class Browser {
  constructor() { this.browser = null; this.context = null; this.page = null; }

  async start({ headless = true, width = 1280, height = 800 } = {}) {
    // Production: connect to a hosted cloud browser if given a websocket URL.
    if (process.env.CHROMIUM_WS) {
      this.browser = await chromium.connectOverCDP(process.env.CHROMIUM_WS);
      this.context = this.browser.contexts()[0] || await this.browser.newContext();
    } else {
      const opts = { headless, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
      if (EXECUTABLE) opts.executablePath = EXECUTABLE;
      this.browser = await chromium.launch(opts);
      this.context = await this.browser.newContext({ viewport: { width, height } });
    }
    this.page = this.context.pages()[0] || await this.context.newPage();
    this.page.setDefaultTimeout(20000);
    return this;
  }

  // ── primitives the computer-use model calls ──
  async goto(url) { await this.page.goto(url, { waitUntil: 'domcontentloaded' }); return this.url(); }
  async screenshot() { return (await this.page.screenshot({ type: 'png' })).toString('base64'); }
  async click(x, y) { await this.page.mouse.click(x, y); await this._settle(); }
  async doubleClick(x, y) { await this.page.mouse.dblclick(x, y); await this._settle(); }
  async move(x, y) { await this.page.mouse.move(x, y); }
  async type(text) { await this.page.keyboard.type(text, { delay: 20 }); }
  async press(keys) { await this.page.keyboard.press(keys); await this._settle(); }
  async scroll(dx, dy) { await this.page.mouse.wheel(dx || 0, dy || 0); await this._settle(300); }
  async url() { return this.page.url(); }
  async title() { return this.page.title(); }
  async text() { return (await this.page.evaluate(() => document.body?.innerText || '')).slice(0, 8000); }

  async size() { const vp = this.page.viewportSize() || { width: 1280, height: 800 }; return vp; }

  async _settle(ms = 600) {
    try { await this.page.waitForLoadState('networkidle', { timeout: 2500 }); } catch {}
    await this.page.waitForTimeout(ms);
  }

  async close() { try { await this.browser?.close(); } catch {} }
}

module.exports = { Browser };

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(pathToFileURL(path.resolve('.pages/index.html')).href);
    await page.waitForFunction(() => window.travelTree);
    await page.evaluate(() => travelTree.ready);
    const result = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere;
      s.setRunning(false); s.flight = null; a.set(true, false); a.mix = 1; a.update(0);
      for (const child of s.scene.children) child.visible = child === a.sky;
      const gl = s.renderer.getContext(), pixel = new Uint8Array(4);
      const frame = () => { s.renderer.render(s.scene, s.camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); };
      const measure = refresh => {
        for (let i = 0; i < 4; i++) frame();
        const start = performance.now();
        for (let i = 0; i < 15; i++) { if (refresh) s.nightGalaxy.time = -1; frame(); }
        return (performance.now() - start) / 15;
      };
      const cachedMs = measure(false), draggingMs = measure(true), cache = s.nightGalaxy;
      const time = cache.time; frame(); const frozen = cache.time === time;
      s.camera.rotateY(.1); s.camera.updateMatrixWorld(); frame();
      const followsCamera = cache.view.equals(s.camera.matrixWorld);
      const width = cache.target.width, lit = pixel[2] > 10;
      s.releaseContext(); frame();
      return { cachedMs, draggingMs, width, frozen, followsCamera, lit, recreated: !!s.nightGalaxy && s.nightGalaxy !== cache };
    });
    assert.ok(result.lit && result.width <= 480 && result.frozen && result.followsCamera && result.recreated, 'bounded cache must render, freeze, track the camera and recreate: ' + JSON.stringify(result));
    assert.ok(result.draggingMs < result.cachedMs + 6, 'forcing a refresh must add less than 6ms on this GPU: ' + JSON.stringify(result));
    assert.deepEqual(errors, []);
    console.log('PASS: night galaxy cache performance, frozen motion, camera tracking and context recreation', result);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

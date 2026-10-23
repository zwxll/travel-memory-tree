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
      const measure = rotate => {
        for (let i = 0; i < 4; i++) frame();
        const start = performance.now();
        for (let i = 0; i < 15; i++) {
          if (rotate) { s.camera.rotateY(.005); s.camera.updateMatrixWorld(); }
          frame();
        }
        return (performance.now() - start) / 15;
      };
      const staticMs = measure(false), draggingMs = measure(true);
      const time = a.effectTime; a.update(.1); frame(); const frozen = a.effectTime === time;
      const noCache = !s.nightGalaxy, calls = s.renderer.info.render.calls, lit = pixel[2] > 10;
      s.releaseContext(); frame();
      a.set(false, false); a.mix = 0; a.update(0); frame();
      a.set(true, true); a.mix = 1; a.update(.1); frame();
      return { staticMs, draggingMs, frozen, calls, lit, noCache, staysDisabled: !s.nightGalaxy && a.sky.material.uniforms.milkyWayStrength.value === 0 };
    });
    assert.ok(result.lit && result.frozen && result.calls === 1 && result.noCache && result.staysDisabled, 'clear sky must use one pass and never allocate a galaxy cache, including after switching modes: ' + JSON.stringify(result));
    assert.deepEqual(errors, []);
    console.log('PASS: clear night sky, single pass, frozen motion and no galaxy allocation', result);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

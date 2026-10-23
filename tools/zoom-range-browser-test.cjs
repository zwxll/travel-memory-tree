const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1908, height: 930 }, reducedMotion: 'reduce', offline: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, '.pages/index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 }); await page.evaluate(() => travelTree.ready);
    const measure = mode => page.evaluate(mode => {
      const s = travelTree.scene; s.setRunning(false); s.setRotation(false, 1, 1); s.setLayoutMode(mode, false); s.flight = null;
      const whole = s.wholeView(), distance = whole.pos.distanceTo(whole.target);
      s.controls.target.copy(whole.target); s.camera.position.copy(whole.target).add(whole.pos.clone().sub(whole.target).multiplyScalar(10));
      s.controls.update(); s._updateCards(0); s.renderer.render(s.scene, s.camera);
      return { distance, limit: s.controls.maxDistance, actual: s.camera.position.distanceTo(s.controls.target), near: s.controls.minDistance };
    }, mode);
    for (const mode of ['carousel', 'heart']) {
      const result = await measure(mode);
      assert.ok(result.limit <= result.distance * 1.01, 'zooming out stops at the complete-tree view: ' + JSON.stringify(result));
      assert.ok(result.actual <= result.limit + .01, 'camera clamps to the new far limit');
      assert.equal(result.near, .7, 'close photo inspection keeps its original limit');
    }
    await measure('carousel');
    await page.locator('#night-toggle').click();
    fs.mkdirSync(path.join(root, '.local'), { recursive: true });
    await page.screenshot({ path: path.join(root, '.local/glimmer-zoom-limit.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => travelTree.scene.width === 390 && travelTree.scene.camera.aspect < 1);
    const mobile = await measure('carousel');
    assert.ok(mobile.limit <= mobile.distance * 1.01 && mobile.actual <= mobile.limit + .01, 'phone resize recalculates the far limit');
    await page.setViewportSize({ width: 1908, height: 930 });
    await page.waitForFunction(() => travelTree.scene.width === 1908 && travelTree.scene.camera.aspect > 1);
    const desktop = await measure('carousel');
    assert.ok(desktop.limit <= desktop.distance * 1.01, 'returning to desktop preserves the larger minimum size');
    assert.deepEqual(errors, []);
    console.log('PASS: larger minimum tree size, camera clamping, unchanged close zoom, both layouts, phone/desktop resize', { desktop, mobile });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

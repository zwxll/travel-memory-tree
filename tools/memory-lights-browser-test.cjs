const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve('.pages/index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 }); await page.evaluate(() => travelTree.ready);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForFunction(w => travelTree.scene.width === w, width);
      for (const effects of [true, false]) {
        const result = await page.evaluate(effects => {
          const s = travelTree.scene; s.setRunning(false); s.atmosphere.set(true, effects); s.atmosphere.update(.1);
          return { softLights: !!s.scene.getObjectByName('tree-soft-memory-lights'), stars: s.atmosphere.sky.material.uniforms.starDensity.value > 0, photos: s.cards.length };
        }, effects);
        assert.equal(result.softLights, false, 'blurred lights around photos must be removed');
        assert.ok(result.stars && result.photos === 72, 'distant stars and demo photos remain');
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: no blurred photo-surrounding lights on desktop/mobile with effects on/off; distant stars and photos retained');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

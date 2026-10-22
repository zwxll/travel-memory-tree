const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    const plaques = await page.evaluate(() => {
      const s = travelTree.scene;
      return { count: s.trunkSigns.length, vertical: s.trunkSigns.every(sign => sign.scale.y > sign.scale.x * 2.5 && sign.material.map.image.height > sign.material.map.image.width * 2.5), lanterns: s.trunkSigns.filter(sign => sign.parent.getObjectByName('photo-city-lantern')).length, photos: s.cards.length };
    });
    assert.equal(plaques.vertical, true, 'tree plaques must be tall wooden tags with portrait city artwork');
    assert.equal(plaques.count, 27); assert.equal(plaques.lanterns, 27); assert.equal(plaques.photos, 164);
    await page.locator('[data-year="2026"]').click();
    if (await page.locator('#year-letter').evaluate(el => el.open)) await page.locator('#letter-enter').click();
    await page.waitForFunction(() => !travelTree.scene.flight && travelTree.scene.year === 2026);
    assert.ok(await page.evaluate(() => {
      const s = travelTree.scene, edge = document.getElementById('cities').getBoundingClientRect().right;
      return s.routeInset > edge && s.photos.filter(p => p.year === 2026).every(photo => (photo.rest.clone().project(s.camera).x + 1) * innerWidth / 2 > edge);
    }), 'desktop photos leave the transparent route column clear');
    const transparent = async () => page.locator('#cities').evaluate(el => {
      const style = getComputedStyle(el), color = style.backgroundColor;
      return { background: color === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(color), radius: style.borderRadius, shadow: style.boxShadow, pointer: style.pointerEvents, readable: style.opacity === '1' };
    });
    for (const mobile of [false, true]) {
      if (mobile) await page.setViewportSize({ width: 390, height: 844 });
      const style = await transparent();
      assert.ok(style.background && style.readable, 'the route background is transparent while its text remains visible');
      assert.equal(style.radius, '0px'); assert.equal(style.shadow, 'none');
      assert.equal(style.pointer, 'none', 'empty sidebar areas let pointer input reach the tree');
    }
    await page.locator('[data-route-city="330100_杭州市"]').click();
    const selection = await page.locator('[data-route-city="330100_杭州市"]').evaluate(el => {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, pointer: style.pointerEvents };
    });
    assert.ok(selection.background === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(selection.background), 'selected route cities must not turn into opaque cards');
    assert.equal(selection.pointer, 'auto');
    assert.equal(await page.evaluate(() => travelTree.state.year), 2026);
    assert.equal(await page.locator('#city-story').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS: 27 portrait city tags with warm lanterns; transparent desktop/mobile route, visible text and working city/story selection');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

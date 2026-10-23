const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = [], network = []; page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await page.goto(pathToFileURL(path.join(root, '.pages/index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 }); await page.evaluate(() => travelTree.ready);
    assert.ok(await page.evaluate(() => travelTree.scene.atmosphere.memoryLights), 'tree has its own soft surrounding lights');
    if (await page.locator('#night-toggle').getAttribute('aria-pressed') !== 'true') await page.locator('#night-toggle').click();
    const result = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere, lights = a.memoryLights;
      s.setRunning(false); s.setRotation(false, 1, 1); s.flight = null;
      const colors = s.cards.map(c => c.mat.color.toArray()), positions = s.cards.map(c => c.photo.rest.toArray());
      a.set(false, false); const dayHidden = !lights.visible;
      a.lowDensity = false; a.set(true, false); s.renderer.render(s.scene, s.camera);
      const p = lights.geometry.attributes.position.array;
      const surrounding = p.every((n, i) => i % 3 !== 0 || Math.abs(n) > 8) && p.some((n, i) => i % 3 === 0 && n < 0) && p.some((n, i) => i % 3 === 0 && n > 0);
      const time = lights.material.uniforms.uTime.value; a.update(.1); const frozen = time === lights.material.uniforms.uTime.value;
      a.set(true, true); a.update(.1); const moving = lights.material.uniforms.uTime.value > time;
      a.set(true, false); s.selected = s.cards[0].photo; a.update(0); const photoClear = !lights.visible; s.selected = null; a.update(0);
      return { dayHidden, surrounding, frozen, moving, photoClear, count: lights.geometry.drawRange.count,
        unchanged: JSON.stringify(colors) === JSON.stringify(s.cards.map(c => c.mat.color.toArray())) && JSON.stringify(positions) === JSON.stringify(s.cards.map(c => c.photo.rest.toArray())) };
    });
    assert.ok(result.dayHidden && result.surrounding && result.frozen && result.moving && result.photoClear && result.unchanged, JSON.stringify(result));
    assert.ok(result.count <= 36, 'keep light density low');
    const visiblePixels = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere, lights = a.memoryLights, gl = s.renderer.getContext();
      const hidden = []; s.scene.traverse(o => { if (o !== s.scene && o !== a.sky && o !== a.group && o !== lights && o.visible) { hidden.push(o); o.visible = false; } });
      const read = visible => { lights.visible = visible; s.renderer.render(s.scene, s.camera); const p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
      const on = read(true), off = read(false); let count = 0;
      for (let i = 0; i < on.length; i += 4) if (Math.max(on[i] - off[i], on[i + 1] - off[i + 1], on[i + 2] - off[i + 2]) > 12) count++;
      hidden.forEach(o => { o.visible = true; }); lights.visible = true; s.renderer.render(s.scene, s.camera); return count;
    });
    assert.ok(visiblePixels > 50, 'soft light pixels are visible: ' + visiblePixels);
    if (await page.locator('#effects-toggle').getAttribute('aria-pressed') === 'true') await page.locator('#effects-toggle').click();
    await page.evaluate(() => { const s = travelTree.scene; s.atmosphere.set(true, false); s.renderer.render(s.scene, s.camera); });
    fs.mkdirSync(path.join(root, '.local'), { recursive: true });
    await page.screenshot({ path: path.join(root, '.local/memory-lights-night.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => travelTree.scene.width === 390);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForFunction(() => travelTree.scene.reducedMotion && !travelTree.scene.atmosphere.enabled);
    const mobile = await page.evaluate(() => { const s = travelTree.scene, a = s.atmosphere; a.lowDensity = true; a.update(0); s.renderer.render(s.scene, s.camera); const t = a.memoryLights.material.uniforms.uTime.value; a.update(.1); return { count: a.memoryLights.geometry.drawRange.count, visible: a.memoryLights.visible, frozen: t === a.memoryLights.material.uniforms.uTime.value, night: a.night, mix: a.mix, selected: !!s.selected }; });
    assert.ok(mobile.count <= 16 && mobile.visible && mobile.frozen, JSON.stringify(mobile));
    await page.screenshot({ path: path.join(root, '.local/memory-lights-mobile.png') });
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    console.log('PASS: local warm lights around the tree, visible pixels, clear photos, day/night, animation/static effects and reduced-motion phone rendering', { result, visiblePixels, mobile });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

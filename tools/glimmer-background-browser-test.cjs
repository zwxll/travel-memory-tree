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
    const errors = [], network = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
    page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await page.goto(pathToFileURL(path.join(root, '.pages/index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    const before = await page.evaluate(() => {
      const s = travelTree.scene; s.setRunning(false); s.flight = null;
      return { colors: s.cards.map(c => c.mat.color.toArray()), positions: s.cards.map(c => c.photo.rest.toArray()) };
    });
    assert.ok(await page.evaluate(() => !travelTree.scene.atmosphere.glimmer), 'daytime does not allocate another WebGL context');
    await page.locator('#night-toggle').click();
    const night = await page.evaluate(() => {
      const s = travelTree.scene; s.atmosphere.set(true, false); s._updateCards(0); s.renderer.render(s.scene, s.camera);
      const bg = s.atmosphere.glimmer;
      return { ready: !!bg, colors: s.cards.map(c => c.mat.color.toArray()), positions: s.cards.map(c => c.photo.rest.toArray()) };
    });
    assert.ok(night.ready, 'night must render the supplied Glimmer Vale source');
    assert.deepEqual(night.colors, before.colors); assert.deepEqual(night.positions, before.positions);
    const inspect = () => page.evaluate(() => {
      const s = travelTree.scene, bg = s.atmosphere.glimmer, canvas = bg.canvas;
      const gl = canvas.getContext('webgl2'), pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let min = 255, max = 0, bright = 0, lowerGlints = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const v = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        min = Math.min(min, v); max = Math.max(max, v); if (v > 180) bright++;
        if (i < canvas.width * Math.floor(canvas.height * .25) * 4 && v > 100) lowerGlints++;
      }
      return { min, max, bright, lowerGlints, width: canvas.width, height: canvas.height, version: bg.texture.version };
    });
    const rendered = await inspect();
    assert.ok(rendered.max - rendered.min > 100 && rendered.bright > 200, 'terrain, bloom and flower pixels render: ' + JSON.stringify(rendered));
    assert.ok(rendered.lowerGlints > 600, 'fine glints fill the former foreground flower area: ' + JSON.stringify(rendered));
    await page.evaluate(() => { const a = travelTree.scene.atmosphere; for (let i = 0; i < 10; i++) a.update(.1); });
    assert.equal((await inspect()).version, rendered.version, 'effects off freezes the source renderer');
    await page.evaluate(() => { const a = travelTree.scene.atmosphere; a.set(true, true); for (let i = 0; i < 10; i++) a.update(.1); });
    assert.ok((await inspect()).version > rendered.version, 'effects on animates the source');
    fs.mkdirSync(path.join(root, '.local'), { recursive: true });
    await page.evaluate(() => { const s = travelTree.scene; s.renderer.render(s.scene, s.camera); });
    await page.screenshot({ path: path.join(root, '.local/glimmer-night.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { const s = travelTree.scene, v = s.wholeView(); s.flight = null; s.camera.position.copy(v.pos); s.controls.target.copy(v.target); s.controls.update(); s._updateCards(0); s.renderer.render(s.scene, s.camera); });
    const mobile = await inspect();
    assert.ok(mobile.width <= 640 && mobile.height <= 960, 'mobile background resolution is bounded');
    const resizeError = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere, uniforms = a.sky.material.uniforms;
      const hidden = s.scene.children.filter(o => o !== a.sky && o.visible);
      hidden.forEach(o => { o.visible = false; });
      s.renderer.render(s.scene, s.camera);
      const output = s.renderer.getContext(), source = a.glimmer.canvas.getContext('webgl2');
      const actual = new Uint8Array(4), expected = new Uint8Array(4);
      let error = 0;
      for (const [x, y] of [[.08, .15], [.92, .15], [.08, .55], [.92, .55]]) {
        output.readPixels(Math.floor(output.drawingBufferWidth * x), Math.floor(output.drawingBufferHeight * y), 1, 1, output.RGBA, output.UNSIGNED_BYTE, actual);
        const u = (x - .5) * uniforms.glimmerScale.value.x + .5;
        const v = (y - .5) * uniforms.glimmerScale.value.y + .5;
        source.readPixels(Math.floor(a.glimmer.canvas.width * u), Math.floor(a.glimmer.canvas.height * v), 1, 1, source.RGBA, source.UNSIGNED_BYTE, expected);
        for (let c = 0; c < 3; c++) error = Math.max(error, Math.abs(actual[c] - expected[c]));
      }
      hidden.forEach(o => { o.visible = true; }); s.renderer.render(s.scene, s.camera);
      return error;
    });
    assert.ok(resizeError < 12, 'resize must refresh the entire texture without old rectangular tiles: ' + resizeError);
    await page.evaluate(() => { const a = travelTree.scene.atmosphere; for (let i = 0; i < 10; i++) a.update(.1); });
    assert.equal((await inspect()).version, mobile.version, 'reduced motion freezes the background');
    await page.screenshot({ path: path.join(root, '.local/glimmer-mobile.png') });
    await page.evaluate(() => { const a = travelTree.scene.atmosphere; a.set(false, false); });
    const day = (await inspect()).version;
    await page.evaluate(() => { const a = travelTree.scene.atmosphere; a.set(false, true); a.update(.1); });
    assert.equal((await inspect()).version, day, 'daytime stops background work');
    await page.evaluate(() => travelTree.scene.releaseContext());
    assert.ok(await page.evaluate(() => !travelTree.scene.atmosphere.glimmer), 'page lifecycle releases the extra context');
    await page.waitForFunction(() => travelTree.scene.contextLost);
    await page.evaluate(() => travelTree.scene.restoreContext());
    await page.waitForFunction(() => !travelTree.scene.contextLost);
    await page.evaluate(() => { const s = travelTree.scene; s.setRunning(false); s.atmosphere.set(true, false); s.renderer.render(s.scene, s.camera); });
    assert.ok((await inspect()).bright > 200, 'restoring the page recreates a working background');
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    console.log('PASS: offline Glimmer Vale pixels, night-only rendering, static/moving effects, bounded mobile resolution, unchanged photos, context cleanup', { rendered, mobile });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

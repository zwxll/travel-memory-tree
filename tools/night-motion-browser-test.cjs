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
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
    await page.goto(pathToFileURL(path.join(root, '.pages/index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 }); await page.evaluate(() => travelTree.ready);
    await page.evaluate(() => { const s = travelTree.scene; s.setRunning(false); s.setRotation(false, 1, 1); s.flight = null; });
    await page.locator('#night-toggle').click();
    assert.ok(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.motionEnabled), 'night sky must support the effects switch');
    const twinkle = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere; a.mix = 1; a.set(true, true);
      const canvas = a.glimmer.canvas, gl = canvas.getContext('webgl2');
      const read = () => { const p = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, p); return p; };
      const before = read(); for (let i = 0; i < 12; i++) a.update(.1); const after = read();
      let changed = 0;
      for (let y = Math.floor(canvas.height * .35); y < canvas.height * .7; y++) for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        if (Math.max(before[i], before[i + 1], before[i + 2]) > 160 && Math.max(...[0, 1, 2].map(c => Math.abs(before[i + c] - after[i + c]))) > 30) changed++;
      }
      a.set(true, false); const version = a.glimmer.texture.version, time = a.effectTime;
      a.update(.1); a.update(.1);
      return { changed, stopped: time === a.effectTime && version === a.glimmer.texture.version, gate: a.sky.material.uniforms.motionEnabled.value };
    });
    assert.ok(twinkle.changed > 100, 'valley star brightness changes visibly: ' + JSON.stringify(twinkle));
    assert.ok(twinkle.stopped && twinkle.gate === 0, 'effects off freezes stars and hides meteors');
    await page.locator('#effects-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.motionEnabled.value), 0);
    await page.locator('#effects-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.motionEnabled.value), 1, 'the actual effects button enables meteors');
    const checkMeteors = () => page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere, u = a.sky.material.uniforms, gl = s.renderer.getContext();
      const hidden = s.scene.children.filter(o => o !== a.sky && o.visible); hidden.forEach(o => { o.visible = false; });
      a.glimmerUnavailable = true;
      const render = (time, active, night) => {
        a.mix = night ? 1 : 0; a.effectTime = time; a.set(night, active); u.glimmerReady.value = 0;
        s.renderer.render(s.scene, s.camera);
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels;
      };
      const difference = (on, off) => {
        let count = 0, x = 0, y = 0;
        for (let row = Math.floor(gl.drawingBufferHeight * .55); row < gl.drawingBufferHeight; row++) for (let col = 0; col < gl.drawingBufferWidth; col++) {
          const i = (row * gl.drawingBufferWidth + col) * 4;
          if (Math.max(...[0, 1, 2].map(c => on[i + c] - off[i + c])) > 30) { count++; x += col; y += row; }
        }
        return { count, x: x / Math.max(1, count), y: y / Math.max(1, count) };
      };
      const first = difference(render(1.4, true, true), render(1.4, false, true));
      const next = difference(render(1.9, true, true), render(1.9, false, true));
      const quiet = difference(render(4, true, true), render(4, false, true));
      const day = difference(render(1.4, true, false), render(1.4, false, false));
      hidden.forEach(o => { o.visible = true; }); a.glimmerUnavailable = false; a.mix = 1; a.set(true, true);
      return { first, next, quiet, day };
    });
    const desktop = await checkMeteors();
    assert.ok(desktop.first.count > 30 && desktop.next.count > 30, 'a luminous meteor trail must render: ' + JSON.stringify(desktop));
    assert.ok(desktop.next.x > desktop.first.x + 25 && desktop.next.y < desktop.first.y - 15, 'meteor crosses the sky diagonally');
    assert.equal(desktop.quiet.count, 0, 'meteors appear occasionally'); assert.equal(desktop.day.count, 0, 'daytime has no meteors');
    await page.evaluate(() => { const s = travelTree.scene; s.atmosphere.effectTime = 1.6; s.atmosphere.update(0); s.renderer.render(s.scene, s.camera); });
    fs.mkdirSync(path.join(root, '.local'), { recursive: true });
    await page.screenshot({ path: path.join(root, '.local/night-meteor.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => travelTree.scene.width === 390);
    const mobile = await checkMeteors(); assert.ok(mobile.first.count > 20, 'meteor remains visible on a phone');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => travelTree.scene.reducedMotion && !travelTree.scene.atmosphere.enabled);
    assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.motionEnabled.value), 0, 'reduced motion removes meteors');
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    console.log('PASS: visible valley twinkle, effects switch, diagonal meteor pixels, quiet intervals, day/reduced-motion suppression, phone and offline rendering', { twinkle, desktop, mobile });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

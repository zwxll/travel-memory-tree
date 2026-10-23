const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  execFileSync(process.execPath, [path.join(__dirname, 'build-site.cjs')], { stdio: 'inherit' });
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = [], network = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
    await page.goto(pathToFileURL(path.join(root, '.pages/index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    assert.equal(await page.evaluate(() => document.body.classList.contains('fallback')), false);
    assert.ok(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.skyTime), 'the existing sky must support drifting clouds');
    fs.mkdirSync(path.join(root, '.local'), { recursive: true });
    const before = await page.evaluate(() => {
      const s = travelTree.scene; s.setRunning(false); s.setRotation(false, 1, 1); s.flight = null;
      s._updateCards(.1); s.renderer.render(s.scene, s.camera);
      return { colors: s.cards.map(c => c.mat.color.toArray()), positions: s.cards.map(c => c.photo.rest.toArray()), meshes: s.scene.children.filter(o => o.material?.uniforms?.topColor).length };
    });
    assert.equal(before.meshes, 1, 'reuse one sky dome');
    await page.screenshot({ path: path.join(root, '.local/sky-day.png') });
    assert.ok(await page.evaluate(() => {
      const a = travelTree.scene.atmosphere, u = a.sky.material.uniforms, start = u.skyTime.value;
      a.update(.1); const moving = u.skyTime.value > start;
      a.set(false, false); const stopped = u.skyTime.value; a.update(.1);
      return moving && u.skyTime.value === stopped;
    }), 'clouds drift with effects enabled and stop with effects off');
    await page.locator('#night-toggle').click();
    const night = await page.evaluate(() => {
      const s = travelTree.scene; s.atmosphere.set(true, false); s._updateCards(0); s.renderer.render(s.scene, s.camera);
      return { colors: s.cards.map(c => c.mat.color.toArray()), positions: s.cards.map(c => c.photo.rest.toArray()), stars: !!s.scene.getObjectByName('quiet-night-stars') };
    });
    assert.ok(night.colors.every((color, i) => color.every((v, c) => Math.abs(v - before.colors[i][c] * 1.3) < .001)), 'sky preserves the existing neutral night photo brightness');
    assert.deepEqual(night.positions, before.positions, 'sky must preserve photo layout');
    assert.equal(night.stars, false, 'stars share the existing sky shader, without a new Points object');
    assert.ok(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.starDensity.value > 0), 'static night keeps distant stars');
    const moonPixels = async () => {
      const png = await page.screenshot();
      return page.evaluate(async source => {
        const image = new Image(); image.src = source; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const c = canvas.getContext('2d'); c.drawImage(image, 0, 0);
        const pixels = c.getImageData(Math.round(image.width * .85) - 30, Math.round(image.height * .25) - 30, 60, 60).data;
        let light = 0, dark = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] > 185 && pixels[i + 1] > 165 && pixels[i + 2] > 120) light++;
          if (pixels[i] < 120 && pixels[i + 1] < 120 && pixels[i + 2] < 140) dark++;
        }
        return { light, dark };
      }, 'data:image/png;base64,' + png.toString('base64'));
    };
    const desktopMoon = await moonPixels();
    assert.ok(desktopMoon.light > 40 && desktopMoon.dark > 400, 'a bright crescent with a dark cutout must render on desktop: ' + JSON.stringify(desktopMoon));
    await page.screenshot({ path: path.join(root, '.local/sky-night.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => travelTree.scene.width === 390 && travelTree.scene.reducedMotion && !travelTree.scene.atmosphere.enabled);
    await page.evaluate(() => {
      const s = travelTree.scene, view = s.wholeView(); s.flight = null;
      s.camera.position.copy(view.pos); s.controls.target.copy(view.target); s.controls.update(); s._updateCards(0); s.renderer.render(s.scene, s.camera);
    });
    const mobileMoon = await moonPixels();
    assert.ok(mobileMoon.light > 20 && mobileMoon.dark > 400, 'crescent stays visible on a phone: ' + JSON.stringify(mobileMoon));
    assert.ok(await page.evaluate(() => {
      const a = travelTree.scene.atmosphere, time = a.sky.material.uniforms.skyTime.value;
      a.update(.1); return !a.enabled && a.sky.material.uniforms.skyTime.value === time;
    }), 'reduced motion freezes clouds without removing the night sky');
    await page.screenshot({ path: path.join(root, '.local/sky-mobile-night.png') });
    await page.locator('#night-toggle').click();
    await page.screenshot({ path: path.join(root, '.local/sky-mobile-day.png') });
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    console.log('PASS: single offline sky dome, drifting/stopped clouds, day/night, desktop/mobile crescent, static shader stars and unchanged photos', { desktopMoon, mobileMoon });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

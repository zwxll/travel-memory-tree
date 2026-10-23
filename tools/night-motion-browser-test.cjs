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
    await page.evaluate(() => travelTree.scene.atmosphere.set(true, false));
    assert.ok(await page.evaluate(() => !travelTree.scene.atmosphere.glimmer && !travelTree.scene.scene.getObjectByName('quiet-night-stars')), 'no valley or separate star-particle system');
    fs.mkdirSync(path.join(root, '.local'), { recursive: true });
    await page.screenshot({ path: path.join(root, '.local/romantic-sky-night.png') });
    assert.ok(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.starDensity), 'the existing dome must render procedural stars');
    const checkStars = () => page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere, u = a.sky.material.uniforms, gl = s.renderer.getContext();
      const hidden = s.scene.children.filter(o => o !== a.sky && o.visible); hidden.forEach(o => { o.visible = false; });
      a.set(true, false);
      const density = u.starDensity.value, haze = u.milkyWayStrength.value;
      const render = (time, stars = density) => {
        u.skyTime.value = time; u.starDensity.value = stars;
        s.renderer.render(s.scene, s.camera);
        const p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, p); return p;
      };
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const plain = render(4, 0), stars = render(4), later = render(10), repeated = render(10);
      const strip = row => {
        let total = 0, count = 0;
        for (let y = row; y < row + 4; y++) for (let x = 0; x < w * .25; x++) { total += plain[(y * w + x) * 4 + 2]; count++; }
        return total / count;
      };
      const gradientDepth = strip(Math.round(h * .1)) - strip(Math.round(h * .95));
      const skyCalls = s.renderer.info.render.calls;
      const material = a.sky.material, source = material.fragmentShader;
      material.fragmentShader = source.replace('color = mix(color, moonColor, moonGlow);', ''); material.needsUpdate = true;
      const noHalo = render(4, 0);
      material.fragmentShader = source; material.needsUpdate = true;
      let haloInner = 0, haloOuter = 0, innerCount = 0, outerCount = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const distance = Math.hypot((x - w * .85) / h, (y - h * .75) / h);
        const i = (y * w + x) * 4, glow = plain[i] - noHalo[i];
        if (distance > .05 && distance < .07) { haloInner += glow; innerCount++; }
        if (distance > .12 && distance < .14) { haloOuter += glow; outerCount++; }
      }
      haloInner /= Math.max(1, innerCount); haloOuter /= Math.max(1, outerCount);
      let pixels = 0, bright = 0, changed = 0, brighter = 0, dimmer = 0, maxChange = 0, lower = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, delta = Math.max(...[0, 1, 2].map(c => stars[i + c] - plain[i + c]));
        if (delta > 8) {
          pixels++; if (delta > 60) bright++; if (y < h * .12) lower++;
          const difference = later[i + 1] - stars[i + 1];
          maxChange = Math.max(maxChange, Math.abs(difference));
          if (difference > 0) brighter++; if (difference < 0) dimmer++;
          if (Math.abs(difference) > 1) changed++;
        }
      }
      const staticPixels = repeated.every((v, i) => v === later[i]);
      a.effectTime = 10; a.update(.1); const stopped = a.effectTime === 10 && u.skyTime.value === 10;
      // Pure translation/zoom along the same view cannot create foreground star parallax.
      const original = s.camera.position.clone(), target = s.controls.target.clone();
      const delta = target.clone().sub(original).normalize().multiplyScalar(3);
      s.camera.position.add(delta); s.controls.target.add(delta); s.camera.updateMatrixWorld();
      const translated = render(10);
      let translationError = 0; for (let i = 0; i < repeated.length; i++) translationError = Math.max(translationError, Math.abs(translated[i] - repeated[i]));
      s.camera.position.copy(original); s.controls.target.copy(target); s.camera.lookAt(target); s.camera.updateMatrixWorld();
      s.camera.rotateY(.15); s.camera.updateMatrixWorld(); const rotated = render(10);
      let moved = 0; for (let i = 0; i < repeated.length; i += 4) if (Math.abs(rotated[i] - repeated[i]) > 12) moved++;
      s.camera.lookAt(target); s.camera.updateMatrixWorld();
      // The optional haze remains a few display levels above the plain gradient.
      u.milkyWayStrength.value = 0; const withoutHaze = render(4, 0); u.milkyWayStrength.value = haze;
      let hazeDelta = 0; for (let i = 0; i < plain.length; i++) hazeDelta = Math.max(hazeDelta, plain[i] - withoutHaze[i]);
      a.mix = 0; a.set(false, false); const dayStars = render(4), dayPlain = render(4, 0);
      const daySuppressed = dayStars.every((v, i) => v === dayPlain[i]);
      u.starDensity.value = density; hidden.forEach(o => { o.visible = true; }); a.set(true, false);
      return { density, pixels, bright, changed, brighter, dimmer, maxChange, lower, staticPixels, stopped, translationError, moved, hazeDelta, daySuppressed, gradientDepth, skyCalls, haloInner, haloOuter };
    });
    const stars = await checkStars();
    assert.ok(stars.gradientDepth > 25 && stars.skyCalls === 1, 'layered blue gradient must render in a single sky pass: ' + JSON.stringify(stars));
    assert.ok(stars.haloInner > stars.haloOuter && stars.haloInner > 1 && stars.haloInner < 20 && stars.haloOuter >= 0, 'moon halo softly fades without a bright ring: ' + JSON.stringify(stars));
    assert.ok(stars.pixels > 400 && stars.pixels < 6000, 'compact realistic star points must remain sparse: ' + JSON.stringify(stars));
    assert.ok(stars.bright < stars.pixels * .5, 'most stars are faint');
    assert.ok(stars.changed > 5 && stars.brighter > 3 && stars.dimmer > 3 && stars.maxChange < 25, 'twinkle is subtle and unsynchronized: ' + JSON.stringify(stars));
    assert.ok(stars.staticPixels && stars.stopped && stars.daySuppressed, 'static night remains frozen and daytime has no stars');
    assert.ok(stars.translationError <= 2 && stars.moved > 80, 'distant stars follow rotation without foreground parallax: ' + JSON.stringify(stars));
    assert.ok(stars.lower === 0 && stars.hazeDelta <= 20, 'visible haze remains subdued without foreground glitter: ' + JSON.stringify(stars));
    await page.locator('#effects-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.motionEnabled.value), 0);
    await page.locator('#effects-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.motionEnabled.value), 1, 'the actual effects button enables meteors');
    const checkMeteors = () => page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere, u = a.sky.material.uniforms, gl = s.renderer.getContext();
      const hidden = s.scene.children.filter(o => o !== a.sky && o.visible); hidden.forEach(o => { o.visible = false; });
      const render = (time, active, night) => {
        a.mix = night ? 1 : 0; a.effectTime = time; a.set(night, active);
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
      const plain = render(4, false, true); let backgroundPoints = 0;
      for (let i = 0; i < gl.drawingBufferWidth * Math.floor(gl.drawingBufferHeight * .55) * 4; i += 4) {
        if (Math.max(plain[i], plain[i + 1], plain[i + 2]) > 140) backgroundPoints++;
      }
      hidden.forEach(o => { o.visible = true; }); a.mix = 1; a.set(true, true);
      return { first, next, quiet, day, backgroundPoints };
    });
    const desktop = await checkMeteors();
    assert.ok(desktop.first.count > 30 && desktop.next.count > 30, 'a luminous meteor trail must render: ' + JSON.stringify(desktop));
    assert.ok(desktop.next.x > desktop.first.x + 25 && desktop.next.y < desktop.first.y - 15, 'meteor crosses the sky diagonally');
    assert.equal(desktop.quiet.count, 0, 'meteors appear occasionally'); assert.equal(desktop.day.count, 0, 'daytime has no meteors');
    assert.ok(desktop.backgroundPoints < 5000, 'background star highlights remain sparse');
    await page.evaluate(() => { const s = travelTree.scene; s.atmosphere.effectTime = 1.6; s.atmosphere.update(0); s.renderer.render(s.scene, s.camera); });
    fs.mkdirSync(path.join(root, '.local'), { recursive: true });
    await page.screenshot({ path: path.join(root, '.local/night-meteor.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForFunction(() => travelTree.scene.width === 390);
    const mobile = await checkMeteors(); assert.ok(mobile.first.count > 20, 'meteor remains visible on a phone');
    const phoneStars = await checkStars();
    assert.ok(phoneStars.density < stars.density && phoneStars.pixels > 10 && phoneStars.pixels < stars.pixels, 'phone uses a reduced, still visible star field: ' + JSON.stringify(phoneStars));
    assert.ok(phoneStars.staticPixels && phoneStars.daySuppressed, 'phone keeps a static sky with effects off');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => travelTree.scene.reducedMotion && !travelTree.scene.atmosphere.enabled);
    assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.sky.material.uniforms.motionEnabled.value), 0, 'reduced motion removes meteors');
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    console.log('PASS: sparse shader stars, independent gentle twinkle, static sky, far-sky camera relation, faint haze, effects switch, meteors, day/reduced-motion, phone and offline', { stars, phoneStars, desktop, mobile });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const entry = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = [], network = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    const ready = async p => { await p.goto(entry); await p.waitForFunction(() => window.travelTree, null, { timeout: 60000 }); await p.evaluate(() => travelTree.ready); };
    await ready(page);
    assert.ok(await page.evaluate(() => travelTree.scene?.atmosphere));
    assert.equal(await page.locator('#night-toggle').getAttribute('aria-pressed'), 'false');
    const before = await page.evaluate(() => {
      const s = travelTree.scene; s.setRunning(false); s.setRotation(false, 1, 1); s.flight = null; s._updateCards(.1);
      return { colors: s.cards.map(c => c.mat.color.toArray()), photos: s.cards.length, positions: s.cards.map(c => c.photo.rest.toArray()), lights: s.scene.children.filter(c => c.isLight).length };
    });
    assert.ok(await page.evaluate(() => {
      const s = travelTree.scene, stones = s.garden.pebbles, matrix = s.camera.matrix.clone();
      if (!stones || stones.count < 600 || stones.count > 1000 || Math.abs(s.tree.scale.y / .682 - 1.1) > 1e-9) return false;
      for (let i = 0; i < stones.count; i++) {
        stones.getMatrixAt(i, matrix); const x = matrix.elements[12], y = matrix.elements[13], z = matrix.elements[14];
        if (Math.hypot(x, z) < 1.4 || Math.hypot(x, z) > 7.4 || y < 0 || y > .2) return false;
      }
      return true;
    }), 'heart pebble paving stays on the ground, inside the flower ring and clear of the trunk');
    const dayHeart = await page.evaluate(() => travelTree.scene.threadHearts.material.emissiveIntensity);
    const dayLamp = await page.evaluate(() => {
      const lamps = travelTree.scene.trunkKeepsakes.getObjectByName('trunk-night-lamps');
      return { count: lamps.children.length, emission: lamps.userData.glassMaterial.emissiveIntensity };
    });
    assert.equal(dayLamp.count, 8, 'eight small love nightlights decorate the trunk');
    assert.equal(before.lights, 5, 'reuse original lights plus a single canopy rim light');
    await page.locator('#night-toggle').click();
    assert.ok(await page.evaluate(() => travelTree.scene.atmosphere.mix < 1), 'day/night change uses a gradual fade');
    const night = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere;
      for (let i = 0; i < 50; i++) s._updateCards(.1);
      const positions = Array.from(a.fireflies.geometry.attributes.position.array); s._updateCards(.1);
      return { mix: a.mix, colors: s.cards.map(c => c.mat.color.toArray()), positions: s.cards.map(c => c.photo.rest.toArray()), stars: a.sky.material.uniforms.starDensity.value > 0, flies: a.fireflies.visible, moving: a.fireflies.geometry.attributes.position.array.some((n, i) => n !== positions[i]), flyCount: a.fireflies.geometry.drawRange.count, pointLights: s.scene.children.filter(c => c.isPointLight).length, rim: a.rim.intensity, photos: s.cards.length };
    });
    assert.ok(await page.evaluate(day => travelTree.scene.threadHearts.material.emissiveIntensity > day * 4 && travelTree.scene.atmosphere.heartSparkles.count > 0, dayHeart), 'jewel hearts and star highlights become brighter at night');
    assert.equal(night.mix, 1); assert.deepEqual(night.colors, before.colors, 'photo color values must not be tinted by night lighting');
    assert.ok(await page.evaluate(day => travelTree.scene.trunkKeepsakes.getObjectByName('trunk-night-lamps').userData.glassMaterial.emissiveIntensity > day, dayLamp.emission), 'nightlights brighten softly after dark');
    assert.deepEqual(night.positions, before.positions, 'night mode does not rearrange photos');
    assert.ok(night.stars && night.flies && night.moving); assert.ok(night.flyCount <= 42); assert.equal(night.pointLights, 1);
    const breath = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere, card = s.cards[0]; s.hovered = card.photo;
      a.enabled = false; a.update(0); const baseline = card.plate.material.emissiveIntensity; a.enabled = true;
      a.update(.1); const first = card.plate.material.emissiveIntensity; a.update(.1);
      const second = card.plate.material.emissiveIntensity; s.hovered = null;
      s.flyToYear(2025); const triggered = a.pulseAge === 0; a.update(.1); const pulse = a.halo.visible && a.halo.material.opacity < .1;
      a.update(.1); return { baseline, first, second, triggered, pulse };
    });
    assert.ok(breath.baseline > .7 && breath.baseline < 1, 'warm paper retains a steady base brightness at night');
    assert.ok(breath.first !== breath.second && breath.first > breath.baseline && breath.second > breath.baseline && breath.first - breath.baseline < .18 && breath.second - breath.baseline < .18, 'breathing stays subtle above the paper base brightness');
    assert.ok(breath.triggered && breath.pulse);
    await page.locator('#effects-toggle').click();
    assert.ok((await page.locator('#atmosphere-status').textContent()).includes('已停止'));
    assert.ok((await page.locator('#effects-toggle').textContent()).includes('已关闭'));
    const off = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere; s.setYear(null); s.flight = null;
      const time = a.effectTime, positions = Array.from(a.fireflies.geometry.attributes.position.array), wind = s.garden.meadow.blades.uniforms.uTime.value;
      for (let i = 0; i < 5; i++) { s.garden.update(s.time + i); s._updateCards(.1); }
      return { frozen: time === a.effectTime && a.fireflies.geometry.attributes.position.array.every((v, i) => v === positions[i]), windFrozen: s.garden.meadow.blades.uniforms.uTime.value === wind, flies: a.fireflies.visible, petals: a.petals.visible, leaf: a.leafUniforms.motion.value, halo: a.halo.visible, stars: a.sky.material.uniforms.starDensity.value > 0, night: a.mix };
    });
    assert.ok(off.frozen && off.windFrozen && !off.flies && !off.petals && !off.halo); assert.equal(off.leaf, 0); assert.equal(off.night, 1); assert.equal(off.stars, true, 'effects off retains static distant stars');
    await page.locator('#night-toggle').click(); assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.mix), 0);
    await page.locator('#night-toggle').click(); await ready(page);
    assert.equal(await page.locator('#night-toggle').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#effects-toggle').getAttribute('aria-pressed'), 'false');
    await page.locator('#effects-toggle').click();
    const low = await page.evaluate(() => {
      const s = travelTree.scene, a = s.atmosphere; s.setRunning(false); s.running = true;
      for (let i = 0; i < 50; i++) a.update(.05);
      s.running = false; return { low: a.lowDensity, flies: a.fireflies.geometry.drawRange.count };
    });
    assert.ok(low.low && low.flies <= 16, 'sustained slow frames automatically reduce density');
    await page.evaluate(() => travelTree.scene.setRunning(true));
    await page.locator('#heart-gather').click();
    await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
    assert.equal(await page.evaluate(() => travelTree.scene.cards.length), before.photos);
    await page.locator('#city-toggle').click(); await page.locator('[data-city]').first().click();
    await page.locator('#city-photos button').first().click();
    await page.waitForFunction(() => document.getElementById('original-photo').naturalWidth > 0);
    assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.fireflies.visible), false, 'photo viewer removes ambient distractions');
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.getElementById('effects-toggle').disabled);
    assert.equal(await page.locator('#effects-toggle').isDisabled(), true);
    assert.equal(await page.evaluate(() => travelTree.scene.atmosphere.enabled), false);
    await page.close();
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, offline: true, reducedMotion: 'reduce' });
    mobile.on('pageerror', e => errors.push(e.message)); await ready(mobile);
    assert.equal(await mobile.locator('#effects-toggle').isDisabled(), true);
    assert.ok(await mobile.evaluate(() => { const a = travelTree.scene.atmosphere; return a.lowDensity && !a.enabled && a.leafUniforms.motion.value === 0; }));
    await mobile.locator('#night-toggle').click();
    assert.ok(await mobile.evaluate(() => { const a = travelTree.scene.atmosphere; return a.mix === 1 && !a.fireflies.visible && !a.petals.visible; }));
    const bounds = await mobile.locator('#atmosphere-controls').boundingBox(), rotation = await mobile.locator('#rotation-controls').boundingBox(), controls = await mobile.locator('#scene-controls').boundingBox();
    assert.ok(controls.x >= 0 && controls.x + controls.width <= 390 && bounds.x >= rotation.x + rotation.width && Math.abs(bounds.y + bounds.height / 2 - rotation.y - rotation.height / 2) < 1, 'mobile controls stay in one scrollable row without overlap');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await mobile.close();
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    console.log('PASS: day/night fade, sparse continuous fireflies/static distant stars, unchanged photo colors/layouts, subtle frame breathing/year halo, effects and wind off, saved preferences, adaptive density, viewing/mode switching, live reduced-motion and mobile controls');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

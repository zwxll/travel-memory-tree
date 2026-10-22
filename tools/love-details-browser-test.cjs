const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const entry = pathToFileURL(path.join(root, 'index.html')).href;

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const errors = [], network = [];
  try {
    const ready = async options => {
      const page = await browser.newPage({ offline: true, ...options });
      page.on('pageerror', e => errors.push(e.message));
      page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
      await page.goto(entry, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
      await page.evaluate(() => travelTree.ready);
      return page;
    };
    const page = await ready({ viewport: { width: 1440, height: 1000 } });
    const details = await page.evaluate(() => {
      const s = travelTree.scene, d = s.loveDetails;
      s.setRunning(false); s.setRotation(false, 1, 1); s.flight = null; s._updateCards(0);
      const mesh = d.petalHeart, matrix = s.camera.matrix.clone();
      let validGround = true, emptyCenter = true;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix); const [x, y, z] = [matrix.elements[12], matrix.elements[13], matrix.elements[14]];
        if (Math.abs(x) > 2.15 || z < 1 || z > 4.85 || y < .009 || y > .32) validGround = false;
        if (Math.hypot(x, z - 2.55) < .45) emptyCenter = false;
      }
      const original = s.cards.map(c => ({ w: c.photo.w, h: c.photo.h, position: c.photo.rest.toArray() }));
      d.canopy.visible = false; d.petalHeart.visible = false; s.renderFirst();
      const base = { calls: s.renderer.info.render.calls, triangles: s.renderer.info.render.triangles };
      d.canopy.visible = true; d.petalHeart.visible = true; s.renderFirst();
      const added = { calls: s.renderer.info.render.calls - base.calls, triangles: s.renderer.info.render.triangles - base.triangles };
      const attach = d.birds.every(b => b.bird.parent.parent === d.canopy) && d.ribbons.every(r => r.parent.parent === d.canopy) && d.letters.every(l => l.parent.parent === d.canopy) && d.canopy.parent === s.tree;
      let decorativeOnly = true;
      d.canopy.traverse(o => { if (s._pickables.includes(o) || o.isLight || o.userData.city || o.userData.photo) decorativeOnly = false; });
      const originalsUnchanged = JSON.stringify(original) === JSON.stringify(s.cards.map(c => ({ w: c.photo.w, h: c.photo.h, position: c.photo.rest.toArray() })));
      return { birds: d.birds.length, ribbons: d.ribbons.length, letters: d.letters.length, petals: mesh.count, attach, validGround, emptyCenter, decorativeOnly, originalsUnchanged, added };
    });
    assert.equal(details.birds, 6); assert.equal(details.ribbons, 5); assert.equal(details.letters, 4); assert.equal(details.petals, 144);
    assert.ok(await page.evaluate(() => {
      const s = travelTree.scene, ribs = s.tree.getObjectByName('tree-canopy-ribs').geometry.attributes.position;
      s.scene.updateMatrixWorld(true);
      return [2, 10, 18].every((sector, index) => {
        const center = s.camera.position.clone().set(0, 0, 0);
        for (let j = 0; j < 10; j++) center.add(s.camera.position.clone().fromBufferAttribute(ribs, sector * 693 + 220 + j));
        center.multiplyScalar(.1); s.tree.localToWorld(center);
        const tangent = center.clone().set(Math.sin(sector * Math.PI / 12), 0, -Math.cos(sector * Math.PI / 12));
        s.raycaster.set(center.clone().addScaledVector(tangent, .5), tangent.clone().negate());
        const hit = s.raycaster.intersectObject(s.loveDetails.canopy.getObjectByName('companion-bird-perch-' + index), false)[0];
        return hit && .5 - hit.distance > .13 && .5 - hit.distance < .18;
      });
    }), 'perch extension matches the original branch thickness at each join');
    assert.ok(await page.evaluate(() => {
      const s = travelTree.scene; s.scene.updateMatrixWorld(true);
      const supported = s.loveDetails.birds.every(({ bird }) => {
        const p = bird.getWorldPosition(s.camera.position.clone());
        s.raycaster.set(p.clone().add(p.clone().set(0, 1, 0)), p.clone().set(0, -1, 0));
        const hit = s.raycaster.intersectObject(bird.userData.perchTwig, false)[0];
        return hit && hit.point.distanceTo(p) < .01;
      });
      const heads = s.loveDetails.birds.map(({ head }) => head.getWorldPosition(s.camera.position.clone()));
      const separate = [0, 2, 4].every(i => heads[i].distanceTo(heads[i + 1]) > .28);
      const outsideLeaves = s.loveDetails.birds.every(({ bird }) => Math.hypot(bird.position.x, bird.position.z) > 20);
      return supported && separate && outsideLeaves;
    }), 'all three pairs sit on supporting twigs outside the leaf rim without deeply intersecting heads');
    assert.ok(details.attach && details.validGround && details.emptyCenter && details.decorativeOnly && details.originalsUnchanged);
    assert.ok(details.added.calls <= 115 && details.added.triangles < 68000, 'reuse light materials/instancing; no extra realtime lights');
    assert.ok(await page.evaluate(() => {
      const d = travelTree.scene.loveDetails, group = d.canopy.getObjectByName('branch-love-lights');
      return group.children.filter(o => o.name.startsWith('branch-love-light-wire-')).length === 8 && d.branchLights.count === 240 && d.branchLights.parent === group;
    }), 'only eight spaced branches carry warm instanced light strings');
    assert.ok(await page.evaluate(() => {
      const s = travelTree.scene;
      return !s.loveDetails.canopy.getObjectByName('branch-love-ribbons').visible && s.loveDetails.letters.every(l => l.getObjectByName('closed-letter-cover')) && s.loveDetails.branchLights.visible && s.trunkKeepsakes.getObjectByName('trunk-love-ribbon').visible;
    }), 'outer hanging ribbons are hidden while branch lights, trunk wrap and paper covers remain');
    assert.ok(fs.readFileSync(path.join(root, 'assets/tree-runtime.js'), 'utf8').includes('Copyright (c) 2021 @yomotsu'), 'MIT attribution travels with the offline bundle');
    const motion = await page.evaluate(() => {
      const s = travelTree.scene, d = s.loveDetails;
      const poses = () => JSON.stringify([d.birds.map(b => [b.body.scale.y, b.head.rotation.y, b.eyes[0].scale.y]), d.ribbons.map(r => [r.rotation.x, r.rotation.z]), d.letters.map(l => [l.rotation.x, l.rotation.z])]);
      const perchPositions = JSON.stringify(d.birds.map(b => b.bird.position.toArray()));
      s.setAtmosphere(false, true); s._updateCards(.1); const before = poses();
      for (let i = 0; i < 10; i++) s._updateCards(.1);
      const moving = before !== poses();
      const feetStayPerched = perchPositions === JSON.stringify(d.birds.map(b => b.bird.position.toArray()));
      const small = [...d.ribbons, ...d.letters].every(o => Math.abs(o.rotation.x) <= .0181 && Math.abs(o.rotation.z) <= .0251);
      s.setAtmosphere(false, false); s._updateCards(0); const stopped = poses();
      for (let i = 0; i < 10; i++) s._updateCards(.1);
      const off = stopped === poses() && d.wind.enabled.value === 0;
      s.setLayoutMode('heart', false); const retained = d.canopy.visible && d.petalHeart.visible;
      s.setLayoutMode('carousel', false);
      return { moving, small, off, retained, feetStayPerched };
    });
    assert.ok(motion.moving && motion.small && motion.off && motion.retained && motion.feetStayPerched);
    const target = await page.evaluate(() => {
      const s = travelTree.scene; const view = s.wholeView(.35);
      s.flight = null; s.camera.position.copy(view.pos); s.controls.target.copy(view.target); s.controls.update(); s._updateCards(0);
      for (const card of s.cards) {
        const v = card.group.position.clone().project(s.camera), x = (v.x + 1) * innerWidth / 2, y = (1 - v.y) * innerHeight / 2;
        if (x > 350 && x < innerWidth - 80 && y > 220 && y < 800 && s.pick(x, y)?.photo === card.photo) return { x, y };
      }
    });
    assert.ok(target, 'photos remain clickable');
    await page.mouse.click(target.x, target.y);
    assert.equal(await page.locator('#photo-dialog').isVisible(), true);
    await page.locator('#photo-city-story').click();
    assert.equal(await page.locator('#city-memory').evaluate(d => d.open), true);
    // Check the reported portrait-border bug with actual portrait/landscape photos.
    await page.locator('#city-memory-close').click(); await page.locator('#photo-close').click();
    await page.locator('#city-toggle').click(); await page.locator('#city-nav [data-city]').first().click(); await page.locator('#city-story-toggle').click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const index of [0, 1]) {
        await page.locator('#city-memory-thumbs button').nth(index).click(); await page.locator('#city-memory-image').evaluate(img => img.decode());
        assert.ok(await page.evaluate(() => {
          const frame = document.querySelector('.memory-print'), image = document.querySelector('#city-memory-image'), style = getComputedStyle(frame);
          const innerWidth = frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
          return Math.abs(innerWidth - image.clientWidth) <= 1 && Math.abs(image.clientWidth / image.clientHeight - image.naturalWidth / image.naturalHeight) < .015;
        }), 'paper border follows the photo aspect ratio on both screen sizes');
      }
    }
    await page.locator('#city-memory-close').click();
    await page.locator('[data-year="2026"]').click(); assert.equal(await page.locator('#year-letter').evaluate(d => d.open), true); await page.locator('#letter-enter').click();
    await page.close();
    const mobile = await ready({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    assert.ok(await mobile.evaluate(() => {
      const s = travelTree.scene, d = s.loveDetails; s.setRunning(false); s._updateCards(0);
      const before = d.ribbons.map(r => r.rotation.toArray()).toString();
      for (let i = 0; i < 10; i++) s._updateCards(.1);
      return d.birds.length === 6 && d.petalHeart.count === 96 && !s.atmosphere.enabled && before === d.ribbons.map(r => r.rotation.toArray()).toString() && document.documentElement.scrollWidth === innerWidth;
    }), 'reduced motion and lower mobile density');
    await mobile.close();
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    console.log('PASS: companion birds, five cloth ribbons, four envelopes, grounded petal outline, gentle/stopped motion, light rendering, photo/city/year interactions, responsive photo-sized paper borders and mobile reduced motion', details.added);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

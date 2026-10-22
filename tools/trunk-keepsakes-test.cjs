const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    assert.equal(await page.evaluate(() => {
      const s = travelTree.scene, stem = s.tree.getObjectByName('tree-main-trunk'), wrap = s.trunkKeepsakes.getObjectByName('trunk-love-ribbon');
      s.scene.updateMatrixWorld(true);
      const a = stem.geometry.attributes.position, b = wrap.geometry.attributes.position;
      if (a.count !== b.count || stem.material.transparent || wrap.material.transparent) return false;
      for (let i = 0; i < a.count; i += 31) {
        const p = s.camera.position.clone().fromBufferAttribute(a, i).applyMatrix4(stem.matrixWorld);
        const q = p.clone().fromBufferAttribute(b, i).applyMatrix4(wrap.matrixWorld);
        if (p.distanceTo(q) > .00001) return false;
      }
      const ring = Array.from({ length: 64 }, (_, i) => a.getX(32 * 65 + i));
      return Math.max(...ring) - Math.min(...ring) < .65;
    }), true, 'slim trunk has a complete opaque ribbon skin flush with its actual curved surface');
    const check = () => page.evaluate(() => {
      const s = travelTree.scene; s.setRunning(false); s.setRotation(false, 1, 1); s.flight = null; s._updateCards(4); s.scene.updateMatrixWorld(true);
      return s.trunkSigns.every(sign => {
        const card = s.cards.find(card => card.group === sign.parent?.parent);
        return card && card.photo.story === sign.userData.city && sign.scale.y >= .65 && sign.scale.y <= 1 && sign.scale.y / (card.photo.h + .1755) < 1.5 && sign.scale.y > sign.scale.x * 2.5 && Math.abs(sign.position.x) - sign.scale.x / 2 > (card.photo.w + .117) / 2 && sign.parent.getObjectByName('photo-city-lantern') && !s.trunkKeepsakes.getObjectById(sign.id);
      });
    });
    assert.equal(await check(), true, 'smaller city tags hang beside their own city photos, outside the frame, with a small lamp');
    assert.equal(await page.evaluate(() => travelTree.scene.trunkSigns.length), 27);
    assert.equal(await page.evaluate(() => {
      const g = travelTree.scene.trunkKeepsakes;
      return !!g.getObjectByName('trunk-love-hearts')?.isInstancedMesh && !!g.getObjectByName('trunk-love-ribbon')?.isMesh && !!g.getObjectByName('trunk-love-bow')?.children.length;
    }), true, 'trunk retains heart pendants, ribbon and bow instead of city tags');
    const target = await page.evaluate(() => {
      const s = travelTree.scene; s.controls.minDistance = .5;
      for (const sign of s.trunkSigns) {
        const p = sign.getWorldPosition(s.camera.position.clone());
        s.camera.position.copy(p).add(p.clone().setY(0).normalize().multiplyScalar(3)); s.controls.target.copy(p); s.controls.update(); s._updateCards(4); s.renderFirst();
        const point = sign.getWorldPosition(p).project(s.camera), x = (point.x + 1) * innerWidth / 2, y = (1 - point.y) * innerHeight / 2;
        if (s.pick(x, y)?.city === sign.userData.city) return { x, y, id: sign.userData.city.id };
      }
    });
    assert.ok(target, 'photo city plaques can still be selected');
    await page.mouse.click(target.x, target.y);
    assert.equal(await page.evaluate(() => travelTree.state.city?.id), target.id);
    for (const mode of ['heart', 'carousel']) {
      await page.evaluate(mode => { const s = travelTree.scene; s.setClusterMode(false); s.setLayoutMode(mode, false); }, mode);
      assert.equal(await check(), true, `${mode}: tags follow their carrier photos`);
    }
    await page.evaluate(() => travelTree.scene.setClusterMode(true));
    assert.equal(await check(), true, 'city grouping keeps tags with photos');
    assert.equal(await page.evaluate(() => {
      const s = travelTree.scene, tag = s.trunkSigns[0], carrier = tag.parent.parent;
      const pickables = s._pickables, grouped = s.clusterMode;
      s._pickables = [tag]; s.clusterMode = false;
      const p = tag.getWorldPosition(s.camera.position.clone());
      s.camera.position.copy(p).add(p.clone().setY(0).normalize().multiplyScalar(3)); s.controls.target.copy(p); s.controls.update(); s.scene.updateMatrixWorld(true);
      const point = p.project(s.camera), x = (point.x + 1) * innerWidth / 2, y = (1 - point.y) * innerHeight / 2;
      carrier.visible = false; s.scene.updateMatrixWorld(true);
      const hidden = !s.pick(x, y);
      carrier.visible = true; s._pickables = pickables; s.clusterMode = grouped; return hidden;
    }), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { const s = travelTree.scene; s.setClusterMode(false); s.setLayoutMode('heart', false); });
    assert.equal(await check(), true, 'mobile keeps the same photo-sized tags');
    assert.deepEqual(errors, []);
    console.log('PASS: 27 smaller photo-attached city plaques, lamps, city selection, both layouts, grouping, mobile and love-only trunk');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 }); await page.evaluate(() => travelTree.ready);
    const report = await page.evaluate(() => {
      const s = travelTree.scene; s.setRunning(false); s.flight = null; s.setRotation(false, 1, 1);
      const records = Array.from({ length: 3 }, (_, i) => ({ id: 'layout-' + i, title: '写给你', recipient: '亲爱的你', body: '我们的故事', signature: '我', date: '2026-10-22' }));
      const modes = [];
      for (const mode of ['carousel', 'heart', 'cluster']) {
        s.setLayoutMode(mode === 'cluster' ? 'carousel' : mode, false); if (mode === 'cluster') s.setClusterMode(true);
        s._updateCards(0); const original = JSON.stringify(s.cards.map(c => [c.photo.rest.toArray(), c.group.position.toArray(), c.group.scale.toArray()]));
        s.setEnvelopes(records); s._updateCards(0); s.scene.updateMatrixWorld(true);
        const point = s.camera.position.clone(), bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
        const photos = s.cards.map(c => { const p = c.group.getWorldPosition(point.clone()); for (const axis of ['X', 'Y', 'Z']) { bounds['min' + axis] = Math.min(bounds['min' + axis], p[axis.toLowerCase()]); bounds['max' + axis] = Math.max(bounds['max' + axis], p[axis.toLowerCase()]); } return p; });
        const letters = s.envelopes.entries.map(e => {
          const p = e.pivot.getWorldPosition(point.clone()), heart = e.pivot.getObjectByName('envelope-cupid-heart'), arrow = e.pivot.getObjectByName('envelope-cupid-arrow');
          return { nearest: Math.min(...photos.map(photo => photo.distanceTo(p))), within: ['X', 'Y', 'Z'].every(axis => p[axis.toLowerCase()] >= bounds['min' + axis] - 1 && p[axis.toLowerCase()] <= bounds['max' + axis] + 1), heart: !!heart, arrow: !!arrow,
            above: !!heart && heart.getWorldPosition(point.clone()).y > p.y + .6,
            through: !!arrow && arrow.getObjectByName('cupid-arrowhead').position.x > .9 && arrow.getObjectByName('cupid-arrow-tail').position.x < -.9 };
        });
        modes.push({ mode, letters, unchanged: original === JSON.stringify(s.cards.map(c => [c.photo.rest.toArray(), c.group.position.toArray(), c.group.scale.toArray()])) });
      }
      s.setClusterMode(false); s.setLayoutMode('carousel', false); s._updateCards(0);
      const e = s.envelopes.entries[0], start = e.world.clone();
      s.setLayoutMode('heart', true); const continuous = e.world.distanceTo(start) < 1e-6;
      for (let i = 0; i < 60; i++) s._updateCards(.05);
      const settled = !s.heartGather && e.world.toArray().every(Number.isFinite);
      const beforeOrbit = e.world.clone(); s.camera.position.x += 8; s.camera.lookAt(s.controls.target); s._updateCards(0);
      modes.push({ continuous, settled, orbitStable: e.world.distanceTo(beforeOrbit) < 1e-6 });
      return modes;
    });
    const transition = report.pop(); assert.ok(transition.continuous && transition.settled && transition.orbitStable, 'letters move smoothly with layout changes and orbiting does not relocate them');
    for (const mode of report) {
      assert.ok(mode.unchanged, `${mode.mode}: photos stay in place`);
      for (const letter of mode.letters) {
        assert.ok(letter.heart && letter.arrow && letter.above && letter.through, `${mode.mode}: a pierced heart hangs above each envelope`);
        assert.ok(letter.within && letter.nearest < 3.3, `${mode.mode}: envelopes share the photo cluster instead of an outer ring (${letter.nearest})`);
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: envelopes sit among photos in carousel/heart/city layouts; pierced-heart hangers; original photo geometry and positions unchanged', JSON.stringify(report));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

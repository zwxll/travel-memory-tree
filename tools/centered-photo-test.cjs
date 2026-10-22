const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    const { layouts, minimumPathRadius, expectedCount } = await page.evaluate(() => {
      const s = travelTree.scene; s.setRunning(false);
      const layouts = Object.fromEntries(['carousel', 'heart'].map(mode => {
        s.setLayoutMode(mode, false);
        const points = s.photos.map(p => p.rest), z = points.map(p => p.z), y = points.map(p => p.y);
        const bottom = Math.min(...s.photos.map(p => p.rest.y - (p.h / 2 + .17 * s.heartScale) * 1.04));
        const top = Math.max(...s.photos.map(p => p.rest.y + p.h / 2 + .17 * s.heartScale));
        const minimumSpacing = Math.min(...points.flatMap((p, i) => points.slice(i + 1).map(q => p.distanceTo(q))));
        const outwardFocus = s.photos.every(photo => {
          const view = s.photoView(photo), direction = view.pos.clone().sub(view.target);
          return direction.x * photo.rest.x + direction.z * photo.rest.z >= -.001;
        });
        return [mode, { bottom, top, span: Math.max(...y) - Math.min(...y), depth: Math.max(...z) - Math.min(...z), zCenter: (Math.max(...z) + Math.min(...z)) / 2, closestToAxis: Math.min(...points.map(p => Math.hypot(p.x, p.z))), minimumSpacing, outwardFocus, anchorsClear: s.photos.every(p => p.anchorY > p.rest.y + p.h / 2 + .5), count: s.cards.filter(c => c.group.visible).length }];
      }));
      let minimumPathRadius = Infinity;
      for (const mode of ['carousel', 'heart', 'carousel']) {
        s.setLayoutMode(mode, true);
        for (let step = 0; step < 20; step++) {
          s._updateCards(.12);
          for (const card of s.cards) minimumPathRadius = Math.min(minimumPathRadius, Math.hypot(card.group.position.x, card.group.position.z));
        }
      }
      return { layouts, minimumPathRadius, expectedCount: travelTree.catalog.photos.length };
    });
    for (const [mode, result] of Object.entries(layouts)) {
      assert.equal(result.count, expectedCount);
      assert.ok(result.bottom > 1.8 && result.bottom < 3, `${mode}: photos float above the flower ring with clear ground spacing`);
      assert.ok(result.span > 11 && result.span < 14 && result.top < 16.5, `${mode}: photos fill the space from the roots to below the canopy`);
      assert.ok(Math.abs(result.zCenter) < .6, `${mode}: photos surround the tree center instead of sitting in front of it`);
      assert.ok(result.depth > 7, `${mode}: retain continuous 3D depth`);
      assert.ok(result.closestToAxis > 1.5, `${mode}: photo centers stay outside the slimmer trunk`);
      assert.ok(result.minimumSpacing > 1.2, `${mode}: repositioning must leave separate photo slots`);
      assert.ok(result.anchorsClear && result.outwardFocus, `${mode}: cords and photo focus remain outside the trunk`);
    }
    assert.ok(minimumPathRadius > 1.5, 'photos must remain outside the trunk during both transition directions');
    console.log('PASS: centered photos from roots to canopy, retained 3D depth, transition clearance and outward focus', { layouts, minimumPathRadius });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

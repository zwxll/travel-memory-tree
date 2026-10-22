const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const phone of [false, true]) {
      const page = await browser.newPage({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, offline: true });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
      await page.evaluate(() => travelTree.ready);
      const ring = await page.evaluate(() => {
        const s = travelTree.scene; s.setRunning(false);
        const group = s.scene.getObjectByName('garden-flower-ring');
        if (!group) return null;
        const centers = group.getObjectByName('garden-flower-centers'), petals = group.getObjectByName('garden-flower-petals');
        const angles = [], radii = [], heights = [];
        for (let i = 0; i < centers.count; i++) {
          const m = centers.instanceMatrix.array, x = m[i * 16 + 12], y = m[i * 16 + 13], z = m[i * 16 + 14];
          angles.push(Math.atan2(z, x)); radii.push(Math.hypot(x, z)); heights.push(y);
        }
        angles.sort((a, b) => a - b);
        const gaps = angles.map((a, i) => (i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2) - a);
        const components = ['garden-flower-petals', 'garden-flower-centers', 'garden-flower-stems', 'garden-flower-leaves'];
        return { count: centers.count, petals: petals.count, maxGap: Math.max(...gaps), minRadius: Math.min(...radii), maxRadius: Math.max(...radii), minHeight: Math.min(...heights), maxHeight: Math.max(...heights), components: components.every(name => group.getObjectByName(name)?.isInstancedMesh), finite: [...centers.instanceMatrix.array, ...petals.instanceMatrix.array].every(Number.isFinite), visible: group.visible && petals.visible, colors: petals.instanceColor ? new Set(Array.from({ length: petals.count }, (_, i) => Array.from(petals.instanceColor.array.slice(i * 3, i * 3 + 3)).join(','))).size : 1, photos: s.cards.length };
      });
      assert.ok(ring, 'the ground must have an explicit ring of recognizable 3D flowers');
      assert.ok(ring.count >= (phone ? 60 : 100) && ring.count <= (phone ? 90 : 160));
      assert.ok(ring.petals >= ring.count * 5, 'each bloom has distinct petals');
      assert.ok(ring.maxGap < .3, 'flowers surround the tree through all 360 degrees');
      assert.ok(ring.minRadius >= 10.5 && ring.maxRadius <= 16.2, 'flowers remain around the perimeter');
      assert.ok(ring.maxRadius - ring.minRadius > 2, 'flowers form a naturally staggered border');
      assert.ok(ring.minHeight > .2 && ring.maxHeight < 1.6, 'low flowers leave suspended photos clear');
      assert.ok(ring.components && ring.finite && ring.visible);
      assert.ok(ring.colors >= 3, 'the flower ring includes several romantic flower colors');
      assert.equal(ring.photos, 164);
      assert.deepEqual(errors, []);
      console.log(`PASS: ${phone ? 'mobile' : 'desktop'} flower ring`, ring);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

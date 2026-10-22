const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, offline: true });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    const result = await page.evaluate(() => {
      const s = travelTree.scene; s.setRunning(false);
      const meshes = s.tree.children.filter(c => /tree-main-trunk|tree-base-roots/.test(c.name));
      let exposedRim = 0, footRadius = 0, trunkRadius = 0, invalid = 0, seamDifference = 0, trunkTopWorld = -Infinity, bottomRimTop = -Infinity;
      for (const mesh of meshes) {
        const p = mesh.geometry.attributes.position, indices = mesh.geometry.index.array;
        // Weld UV seam vertices before finding physically open mesh boundaries.
        const keys = Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)].map(v => v.toFixed(4)).join(','));
        const edges = new Map();
        for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
          const a = indices[i + j], b = indices[i + (j + 1) % 3];
          const key = [keys[a], keys[b]].sort().join('|');
          const edge = edges.get(key) || { count: 0, a, b }; edge.count++; edges.set(key, edge);
        }
        for (const edge of edges.values()) if (edge.count === 1) for (const i of [edge.a, edge.b]) {
          if (Math.hypot(p.getX(i), p.getZ(i)) > 1.9 && p.getY(i) > .02 && p.getY(i) < 5) exposedRim++;
        }
        for (let i = 0; i < p.count; i++) {
          const radius = Math.hypot(p.getX(i), p.getZ(i)), y = p.getY(i);
          if (![radius, y].every(Number.isFinite)) invalid++;
          if (y < .9) footRadius = Math.max(footRadius, radius);
          if (y > 3 && y < 5) trunkRadius = Math.max(trunkRadius, radius);
        }
        if (mesh.name === 'tree-main-trunk') {
          const n = mesh.geometry.attributes.normal, sides = mesh.geometry.parameters.radialSegments;
          mesh.updateWorldMatrix(true, false);
          const point = s.camera.position.clone();
          for (let i = 0; i < p.count; i++) {
            point.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
            trunkTopWorld = Math.max(trunkTopWorld, point.y);
            if (i <= sides) bottomRimTop = Math.max(bottomRimTop, point.y);
            if (![n.getX(i), n.getY(i), n.getZ(i)].every(Number.isFinite)) invalid++;
          }
          for (let first = 0; first < p.count; first += sides + 1) {
            const last = first + sides;
            seamDifference = Math.max(seamDifference, Math.hypot(n.getX(first) - n.getX(last), n.getY(first) - n.getY(last), n.getZ(first) - n.getZ(last)));
          }
        }
      }
      return { exposedRim, footRadius, trunkRadius, invalid, seamDifference, trunkTopWorld, bottomRimTop, shadowWidth: s.tree.getObjectByName('tree-root-contact-shadow')?.geometry.parameters.width, photos: s.cards.length, crown: !!s.tree.getObjectByName('tree-leaf-crown'), wrapped: s.tree.getObjectByName('tree-main-trunk').material.name === 'opaque-love-ribbon-wrap' && !s.tree.getObjectByName('tree-main-trunk').material.bumpMap };
    });
    assert.equal(result.exposedRim, 0, 'outer root tips must enter the ground without exposed open tube rims');
    assert.equal(result.invalid, 0, 'root and trunk vertices must be finite');
    assert.ok(result.seamDifference < .001, 'the bark UV seam must have continuous lighting');
    assert.ok(result.footRadius > result.trunkRadius + .3, 'the trunk must flare naturally at ground level');
    assert.ok(result.trunkRadius < .85, 'the thinner trunk must leave the central photo column clear');
    assert.ok(result.footRadius < 1.35, 'the integrated roots must shrink with the trunk');
    assert.ok(result.shadowWidth > 3.2 && result.shadowWidth < 3.5, 'the contact shadow must fit the slimmer base');
    assert.ok(result.bottomRimTop < -.08, 'the entire lower rim must remain buried');
    assert.ok(result.trunkTopWorld > 18.3 && result.trunkTopWorld < 18.5, 'the shorter tree must lower the canopy by about one quarter');
    assert.equal(result.photos, 164);
    assert.equal(result.crown, true);
    assert.equal(result.wrapped, true, 'the entire trunk must use satin wrapping instead of the bark material');
    console.log('PASS: buried root boundaries, flared compact base, finite geometry, retained canopy and 164 photos', result);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/assets/travel-ring-tree/heart-layout.js'), 'utf8');
  const { heartLayout } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const catalog = require('./fixtures/catalog.cjs');
  const photos = catalog.map(p => ({ aspect: 1 / p.aspect }));
  const points = heartLayout(photos);
  assert.equal(points.length, 164, 'the complete catalog must appear in the heart');
  // The fixture exercises both portrait and landscape photo sizes.
  const meanWidth = points.reduce((sum, p) => sum + p.w, 0) / points.length;
  const meanHeight = points.reduce((sum, p) => sum + p.h, 0) / points.length;
  assert.ok(meanWidth >= 1.267 && meanHeight >= 1.182, 'actual photo sizes must grow at least 35%, including any spacing cap');
  assert.equal(new Set(points.map(p => p.x + ',' + p.y + ',' + p.z)).size, 164, 'each photo needs its own 3D position');
  const xs = points.map(p => p.x), ys = points.map(p => p.y), zs = points.map(p => p.z);
  const left = Math.min(...xs), right = Math.max(...xs), bottom = Math.min(...ys), top = Math.max(...ys);
  const back = Math.min(...zs), front = Math.max(...zs), depth = front - back;
  assert.ok(depth >= (right - left) * .35, 'the heart must have substantial depth, not a plane');
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    assert.ok([p.x, p.y, p.z, p.w, p.h].every(Number.isFinite));
    assert.ok(Math.abs(p.h / p.w - photos[i].aspect) < 1e-8, 'photo aspect ratio must be preserved');
    for (let j = i + 1; j < points.length; j++) {
      const q = points[j];
      const distance = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
      const radius = photo => Math.hypot(photo.w + .18, photo.h + .27) * .52;
      assert.ok(distance > radius(p) + radius(q) + .04, 'frames need 3D breathing room even when highlighted');
    }
  }
  for (let layer = 0; layer < 3; layer++) {
    const inLayer = points.filter(p => p.z >= back + depth * layer / 3 && p.z <= back + depth * (layer + 1) / 3);
    assert.ok(inLayer.length >= points.length * .15, 'front, middle and back must each hold photos');
    assert.ok(Math.max(...inLayer.map(p => p.x)) - Math.min(...inLayer.map(p => p.x)) > (right - left) * .45, 'every depth region must have lateral volume');
  }
  assert.ok(new Set(zs.map(z => z.toFixed(3))).size > points.length * .8, 'depth must vary continuously rather than duplicate a few flat layers');
  const upper = points.filter(p => p.y > top - (top - bottom) * .17);
  assert.ok(upper.some(p => p.x < left * .35) && upper.some(p => p.x > right * .35), 'both heart lobes must be full');
  assert.ok(!upper.some(p => Math.abs(p.x) < right * .16), 'the upper center must retain the heart notch');
  assert.ok(points.filter(p => p.y === bottom).every(p => Math.abs(p.x) < right * .2), 'the heart must taper to a centered tip');
  assert.ok(points.filter(p => p.y > bottom + (top - bottom) * .35 && p.y < bottom + (top - bottom) * .65).some(p => Math.abs(p.x) < right * .1), 'the center must be filled rather than outlined');
  assert.ok(points.every(p => Math.hypot(p.x, p.z) < 19), 'the volume must fit below the tree canopy');
  assert.ok(points.every(p => .5 + p.y * .7 + (p.h + .27) * .325 <= 18.5), 'larger frames must remain below the canopy');
  assert.ok(points.every(p => .5 + p.y * .7 - (p.h + .27) * .325 > .3), 'larger frames must remain above the ground');
  assert.ok(points.every(p => Math.hypot(p.x * .65, p.z * .65) + Math.hypot(p.w + .18, p.h + .27) * .325 < 16), 'the centered volume must remain inside the canopy radius');
  assert.deepEqual(heartLayout(photos), points, 'layout must be deterministic');
  assert.deepEqual(heartLayout([]), []);
  for (const count of [1, 2, 3, 8]) {
    const small = heartLayout(Array.from({ length: count }, () => ({ aspect: .75 })));
    assert.equal(small.length, count);
    assert.ok(small.every(p => Number.isFinite(p.x + p.y + p.z) && p.w > 0 && p.h > 0));
  }
  console.log('PASS: 164 unique, spaced, proportional photos; filled lobes, notch, tip; continuous 3D volume; empty/small catalogs');
})().catch(error => { console.error(error); process.exitCode = 1; });

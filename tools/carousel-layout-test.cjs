const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/assets/travel-ring-tree/carousel-layout.js'), 'utf8');
  const { carouselLayout } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const canopyHeight = r => 24.65 + 5 * (1 - Math.min(r / 16, 1) ** 2);
  const one = { h: .8 }, city = { photos: [one] };
  const single = carouselLayout([one], [city], canopyHeight, .8);
  assert.equal(single.positions.length, 1, 'the old hanging layout must place every photo');
  const p = single.positions[0];
  assert.ok(Math.abs(p.x - 6.188445598) < .0001 && Math.abs(p.z - 4.581827264) < .0001, 'restore the original natural-layout radius and city angle');
  assert.ok(Math.abs(p.anchorY - 22.79359375) < .0001 && Math.abs(p.y - 12.976796875) < .0001, 'retain the original canopy clearance and uniform photo lift');
  assert.equal(one.rest, undefined, 'layout generation must not mutate current photo positions');
  const catalog = require('./fixtures/catalog.cjs');
  const photos = catalog.map(p => ({ ...p, w: 1.1, h: .9 })), groups = new Map();
  photos.forEach(photo => { if (!groups.has(photo.cityKey)) groups.set(photo.cityKey, { photos: [] }); groups.get(photo.cityKey).photos.push(photo); });
  const cities = [...groups.values()], original = carouselLayout(photos, cities, canopyHeight, .8);
  assert.equal(original.positions.length, 164);
  assert.equal(original.sectors.length, 27);
  for (const p of original.positions) {
    assert.ok([p.x, p.y, p.z, p.anchorY].every(Number.isFinite));
    assert.ok(Math.hypot(p.x, p.z) >= 6 && Math.hypot(p.x, p.z) <= 12.8);
    assert.ok(p.anchorY - p.y - .45 > .2, 'large photos must stay below their suspension anchor');
  }
  for (let cycle = 0; cycle < 20; cycle++) {
    photos.forEach((photo, i) => { photo.rest = { x: i * .1, y: i * .2, z: cycle }; });
    const restored = carouselLayout(photos, cities, canopyHeight, .8);
    assert.deepEqual(restored, original, 'heart/carousel round trips must not depend on the previous mode or accumulate drift');
  }
  assert.deepEqual(carouselLayout([], [], canopyHeight, .8), { positions: [], sectors: [], photoLift: 0 });
  console.log('PASS: original natural positions and canopy clearance; all 164 photos/27 city sectors; repeated round trips without drift; empty catalog');
})().catch(error => { console.error(error); process.exitCode = 1; });

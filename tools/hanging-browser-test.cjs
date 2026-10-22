const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    assert.equal(await page.evaluate(() => !!travelTree.scene.photoThreads), true, 'every photo must remain visibly suspended from the tree');
    const result = await page.evaluate(() => {
      const s = travelTree.scene; s.setRunning(false); s.gatherHeart();
      const starts = s.cards.map(c => c.group.position.clone());
      const connected = () => {
        const attr = s.photoThreads.geometry.attributes.position;
        return s.threadHearts.count === s.cards.length && attr.count === s.cards.length * 4 && s.cards.every((card, i) => {
          const end = card.clip.localToWorld(card.photo.rest.clone().set(0, card.clip.geometry.parameters.height / 2, 0));
          const anchor = end.clone().set(attr.getX(i * 4), attr.getY(i * 4), attr.getZ(i * 4));
          const tip = end.clone().set(attr.getX(i * 4 + 3), attr.getY(i * 4 + 3), attr.getZ(i * 4 + 3));
          const crown = s.tree.worldToLocal(anchor.clone());
          const matrix = s.camera.matrix.clone(); s.threadHearts.getMatrixAt(i, matrix);
          const heart = end.clone().setFromMatrixPosition(matrix);
          const neck = end.clone().set(attr.getX(i * 4 + 1), attr.getY(i * 4 + 1), attr.getZ(i * 4 + 1));
          const along = (anchor.y - heart.y) / (anchor.y - neck.y);
          const onLine = anchor.clone().lerp(neck, along).distanceTo(heart) < .001 && along > .2 && along < .9;
          return onLine && anchor.y - end.y < 17.8 && tip.distanceTo(end) < .001 && anchor.y > end.y + .5 && Math.hypot(crown.x, crown.z) < 16 && crown.y > 24 && crown.y < 31;
        });
      };
      const startConnected = connected(); s._updateCards(.3);
      const beganMoving = s.cards.some((c, i) => c.group.position.distanceTo(starts[i]) > .001);
      s._updateCards(.8);
      const moved = s.cards.some((c, i) => c.group.position.distanceTo(starts[i]) > .1), movingConnected = connected();
      s._updateCards(4);
      const ended = !s.heartGather && s.cards.every(c => c.group.position.distanceTo(c.photo.rest) < .001), endConnected = connected();
      s.setClusterMode(true); const groupedHidden = !s.photoThreads.visible && !s.threadHearts.visible;
      s.setClusterMode(false); const heartVisible = s.photoThreads.visible && s.threadHearts.visible;
      s.setRunning(true);
      return { startConnected, beganMoving, moved, movingConnected, ended, endConnected, groupedHidden, heartVisible };
    });
    for (const [name, passed] of Object.entries(result)) assert.equal(passed, true, name);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => {
      const s = travelTree.scene, view = s.wholeView();
      return s.controls.maxDistance >= view.pos.distanceTo(view.target) * 1.49;
    }), true, 'resizing must leave enough camera distance for the entire tree');
    console.log('PASS: 164 suspended clips/cords at start, during switching, and at rest; animated transition; grouped visibility; mobile camera range');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

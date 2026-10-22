const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    assert.equal(await page.locator('#rotation-controls button').count(), 3, '右上角提供布局、旋转及速度按钮');
    for (const speed of [2, 3, 1]) {
      await page.locator('#rotation-speed').click();
      assert.equal(await page.locator('#rotation-speed').textContent(), `转速：${speed}倍`);
      assert.ok(await page.evaluate(speed => travelTree.scene.rotationSpeed === speed && Math.abs(travelTree.scene.controls.autoRotateSpeed - .35 * speed) < 1e-9, speed), 'selected speed controls scene rotation');
    }
    assert.equal(await page.locator('#heart-gather').textContent(), '重聚爱心');
    assert.equal(await page.locator('#rotation-toggle').textContent(), '暂停旋转');
    await page.locator('#rotation-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), false);
    await page.locator('#rotation-speed').click();
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), false, 'changing speed keeps manual pause');
    assert.equal(await page.evaluate(() => travelTree.scene.rotationSpeed), 2);
    assert.equal(await page.locator('#rotation-toggle').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-year="2025"]').click();
    if (await page.locator('#year-letter').evaluate(el => el.open)) await page.locator('#letter-enter').click();
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), false, '选择年份保留手动暂停');
    await page.locator('[data-year="all"]').click();
    await page.locator('#rotation-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), true);
    await page.waitForFunction(() => !travelTree.scene.flight);
    const initial = await page.evaluate(() => {
      const s = travelTree.scene;
      return { mode: s.layoutMode, rotation: s.rotationActive, stones: s.garden.pebbles.count, positions: s.cards.map(c => c.photo.rest.toArray()) };
    });
    assert.equal(initial.mode, 'carousel'); assert.equal(initial.rotation, true);
    assert.ok(await page.evaluate(() => {
      const s = travelTree.scene;
      return s.cards.every(c => Math.abs(c.group.scale.x / (c.photo === s.hovered || c.photo === s.selected ? 1.04 : 1) - 1.15) < 1e-9);
    }), 'carousel photos render at 1.15x');
    const point = await page.evaluate(() => {
      const s = travelTree.scene;
      for (const card of s.cards) {
        const v = card.group.position.clone().project(s.camera), x = (v.x + 1) * innerWidth / 2, y = (1 - v.y) * innerHeight / 2;
        if (x > 350 && x < 1250 && y > 220 && y < 780 && s.pick(x, y)?.photo === card.photo) return { x, y };
      }
    });
    assert.ok(point, '木马场景照片可被直接点击');
    await page.mouse.click(point.x, point.y);
    await page.waitForFunction(() => !!travelTree.state.photo);
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), false);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), true, '关闭照片后木马恢复旋转');
    await page.locator('#heart-gather').click();
    await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
    assert.equal(await page.locator('#heart-gather').textContent(), '旋转木马');
    assert.equal(await page.evaluate(() => travelTree.scene.layoutMode), 'heart');
    assert.equal(await page.evaluate(() => travelTree.scene.rotationSpeed), 2, 'speed selection survives layout switches');
    assert.ok(await page.evaluate(() => {
      const s = travelTree.scene;
      return s.cards.every(c => Math.abs(c.group.scale.x / (c.photo === s.hovered || c.photo === s.selected ? 1.04 : 1) - 1) < 1e-9);
    }), 'heart photos retain their existing size');
    assert.ok(await page.evaluate(() => {
      const s = travelTree.scene, stones = s.garden.pebbles, matrix = s.camera.matrix.clone();
      let centerFilled = false;
      for (let i = 0; i < stones.count; i++) { stones.getMatrixAt(i, matrix); if (Math.hypot(matrix.elements[12], matrix.elements[14]) < .3) centerFilled = true; }
      return s.tree.getObjectByName('tree-main-trunk').visible && s.tree.getObjectByName('tree-root-contact-shadow').visible && s.trunkKeepsakes.visible && s.tree.visible && centerFilled;
    }), 'heart mode retains the slim wrapped trunk and ornaments, crown and center pebbles');
    assert.ok(await page.evaluate(count => travelTree.scene.garden.pebbles.count > count, initial.stones));
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), false);
    assert.equal(await page.locator('#rotation-toggle').textContent(), '开始旋转');
    await page.locator('#rotation-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), true, '立体爱心也能手动启动旋转');
    const azimuth = await page.evaluate(() => travelTree.scene.controls.getAzimuthalAngle());
    await page.waitForFunction(angle => Math.abs(travelTree.scene.controls.getAzimuthalAngle() - angle) > .002, azimuth);
    await page.locator('#rotation-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), false);
    const heart = await page.evaluate(() => travelTree.scene.cards.map(c => c.photo.rest.toArray()));
    assert.notDeepEqual(heart, initial.positions);
    for (let i = 0; i < 3; i++) {
      await page.locator('#heart-gather').click();
      await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
      assert.equal(await page.locator('#heart-gather').textContent(), '重聚爱心');
      assert.ok(await page.evaluate(count => {
        const s = travelTree.scene;
        return s.tree.getObjectByName('tree-main-trunk').visible && s.tree.getObjectByName('tree-root-contact-shadow').visible && s.trunkKeepsakes.visible && s.garden.pebbles.count === count;
      }, initial.stones), 'carousel restores the complete trunk and ornaments, reserving their original space');
      assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), true);
      assert.deepEqual(await page.evaluate(() => travelTree.scene.cards.map(c => c.photo.rest.toArray())), initial.positions, '每次恢复相同的原照片分布');
      assert.deepEqual(await page.evaluate(() => travelTree.scene.cards.map(c => c.group.position.toArray())), initial.positions, '实际照片回到原位置');
      await page.locator('#heart-gather').click();
      await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
      assert.deepEqual(await page.evaluate(() => travelTree.scene.cards.map(c => c.photo.rest.toArray())), heart);
    }
    await page.locator('#heart-gather').click();
    await page.locator('#heart-gather').click();
    await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
    assert.equal(await page.evaluate(() => travelTree.scene.layoutMode), 'heart');
    assert.deepEqual(await page.evaluate(() => travelTree.scene.cards.map(c => c.group.position.toArray())), heart, '快速往返不能留下中间状态');
    await page.locator('#city-toggle').click();
    await page.locator('#city-layout').click();
    await page.locator('[data-ring-toggle]').first().click();
    await page.locator('#heart-gather').click();
    await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
    assert.equal(await page.evaluate(() => !travelTree.state.grouped && !travelTree.scene.clusterMode && travelTree.scene.cards.every(c => c.group.visible)), true);
    await page.locator('[data-city]').first().click();
    await page.locator('#rotation-toggle').click();
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), false);
    if (!(await page.locator('#city-photos').isVisible())) await page.locator('#city-story-toggle').click();
    await page.locator('#city-photos button').first().click();
    assert.equal(await page.locator('#rotation-toggle').isDisabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => travelTree.scene.rotationActive), false, '关闭照片保留手动暂停');
    if (!(await page.locator('#city-photos').isVisible())) await page.locator('#city-story-toggle').click();
    await page.locator('#city-photos button').first().click();
    await page.locator('#heart-gather').click();
    await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
    assert.equal(await page.locator('#photo-dialog').isVisible(), false);
    assert.equal(await page.evaluate(() => travelTree.scene.camera.position.toArray().every(Number.isFinite)), true);
    await page.locator('[data-year="2003"]').click();
    if (await page.locator('#year-letter').evaluate(el => el.open)) await page.locator('#letter-enter').click();
    await page.locator('#heart-gather').click();
    await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
    assert.equal(await page.evaluate(() => travelTree.state.year), null);
    assert.equal(await page.evaluate(() => travelTree.scene.cards.filter(c => c.group.visible).length), await page.evaluate(() => travelTree.catalog.photos.length));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#heart-gather').click();
    await page.waitForFunction(() => !travelTree.scene.heartGather && !travelTree.scene.flight);
    assert.equal(await page.locator('#rotation-controls button').count(), 3);
    const controlsFit = await page.locator('#rotation-controls').evaluate(nav => {
      const rect = nav.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth;
    });
    assert.equal(controlsFit, true, '手机上布局、旋转和速度按钮完整显示');
    assert.equal(await page.evaluate(() => travelTree.scene.camera.position.toArray().every(Number.isFinite)), true);
    assert.deepEqual(errors, []);
    await page.close();
    const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, offline: true, reducedMotion: 'reduce' });
    await reduced.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await reduced.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await reduced.evaluate(() => travelTree.ready);
    assert.equal(await reduced.evaluate(() => travelTree.scene.rotationActive), false);
    assert.equal(await reduced.locator('#rotation-toggle').textContent(), '开始旋转');
    await reduced.locator('#rotation-toggle').click();
    assert.equal(await reduced.evaluate(() => travelTree.scene.rotationActive), true, '减少动态效果仍允许用户主动旋转');
    await reduced.locator('#rotation-toggle').click();
    await reduced.locator('#heart-gather').click();
    assert.equal(await reduced.evaluate(() => travelTree.scene.layoutMode === 'heart' && !travelTree.scene.heartGather), true);
    await reduced.locator('#heart-gather').click();
    assert.equal(await reduced.evaluate(() => travelTree.scene.layoutMode === 'carousel' && !travelTree.scene.heartGather), true);
    await reduced.close();
    console.log('PASS: layout toggle and independent rotation; pause survives year/viewer changes; rotating 3D heart; original carousel restore x3; rapid toggle; mobile; reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

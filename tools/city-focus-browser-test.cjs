const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);

    const blankPoint = () => page.evaluate(() => {
      const scene = travelTree.scene, canvas = document.getElementById('scene');
      for (let y = 180; y < innerHeight - 100; y += 60) for (let x = 460; x < innerWidth - 40; x += 60) {
        if (document.elementFromPoint(x, y) === canvas && !scene.pick(x, y)) return { x, y };
      }
    });
    const selectCity = async () => {
      if (!(await page.locator('#city-nav').isVisible())) await page.locator('#city-toggle').click();
      await page.locator('#city-nav [data-city]').first().click();
      await page.waitForFunction(() => !travelTree.scene.flight);
      assert.ok(await page.evaluate(() => travelTree.state.city && travelTree.scene.cards.some(card => card.dim === 1)), 'selecting a city dims other cities');
    };
    const cameraView = () => page.evaluate(() => {
      const s = travelTree.scene, round = numbers => numbers.map(n => Math.round(n * 1e6) / 1e6);
      return { position: round(s.camera.position.toArray()), target: round(s.controls.target.toArray()), rotation: round(s.camera.quaternion.toArray()), zoom: s.camera.zoom, projection: s.camera.view };
    });
    const restore = async () => {
      await page.evaluate(() => { delete window.__focusCameraLast; });
      await page.waitForFunction(() => {
        const s = travelTree.scene, values = [...s.camera.position.toArray(), ...s.controls.target.toArray(), ...s.camera.quaternion.toArray()];
        const previous = window.__focusCameraLast;
        window.__focusCameraLast = values;
        return !s.flight && previous && values.every((value, i) => Math.abs(value - previous[i]) < 1e-8);
      });
      const point = await blankPoint();
      assert.ok(point, 'a non-photo scene area is available');
      const before = await cameraView();
      const year = await page.evaluate(() => travelTree.state.year);
      await page.mouse.click(point.x, point.y);
      assert.equal(await page.evaluate(() => travelTree.state.city?.id ?? null), null, 'clicking a non-photo scene area clears city selection');
      assert.equal(await page.evaluate(() => travelTree.state.year), year, 'clearing city focus retains the current year');
      assert.ok(await page.evaluate(() => {
        const s = travelTree.scene;
        return s.cards.every(card => {
          const active = s.year === null || card.photo.year === s.year;
          return card.dim === (active ? 0 : 1) && (!active || !card.loaded || card.mat.color.r > .99);
        });
      }), 'all photos in the current year selection return to full brightness');
      assert.equal(await page.locator('#city-nav [aria-pressed="true"]').count(), 0, 'the city list clears its selected state');
      await page.waitForFunction(() => !travelTree.scene.flight);
      assert.deepEqual(await cameraView(), before, 'clearing city focus keeps the current camera position, direction and zoom');
    };

    await selectCity();
    await restore();
    await selectCity();
    const point = await blankPoint(), cityId = await page.evaluate(() => travelTree.state.city.id);
    await page.mouse.move(point.x, point.y); await page.mouse.down();
    await page.mouse.move(point.x + 30, point.y + 15); await page.mouse.up();
    assert.equal(await page.evaluate(() => travelTree.state.city.id), cityId, 'dragging the scene keeps the city selection');
    const photoPoint = await page.evaluate(() => {
      const s = travelTree.scene;
      for (const card of s.cards.filter(card => card.photo.story === travelTree.state.city)) {
        const v = card.group.getWorldPosition(s.camera.position.clone()).project(s.camera);
        const x = (v.x + 1) * innerWidth / 2, y = (1 - v.y) * innerHeight / 2;
        if (document.elementFromPoint(x, y) === document.getElementById('scene') && s.pick(x, y)?.photo === card.photo) return { x, y };
      }
    });
    assert.ok(photoPoint, 'a selected city photo is directly clickable');
    await page.mouse.click(photoPoint.x, photoPoint.y);
    assert.ok(await page.evaluate(() => travelTree.state.photo), 'clicking a photo still opens it');
    assert.equal(await page.evaluate(() => travelTree.state.city.id), cityId, 'clicking a photo retains its city selection');
    await page.locator('#photo-close').click();
    await page.waitForFunction(() => !travelTree.scene.flight);
    await restore();

    for (const control of ['#heart-gather', '#city-layout']) {
      await page.locator(control).click();
      await page.waitForFunction(() => !travelTree.scene.flight && !travelTree.scene.heartGather);
      await selectCity(); await restore();
    }
    await page.locator('[data-year="2022"]').click();
    await page.locator('#letter-enter').click();
    await page.locator('#route-list [data-route-city]').first().click();
    await page.waitForFunction(() => !travelTree.scene.flight);
    await restore();
    assert.deepEqual(errors, []);
    console.log('PASS: city focus clears without moving the camera in carousel, heart and city layouts; year selection, photo clicks and dragging retain their behavior');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

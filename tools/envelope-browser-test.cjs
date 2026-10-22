const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const entry = pathToFileURL(path.join(root, 'index.html')).href;
const parse = text => JSON.parse(text.trim().replace(/^window\.travelTreeAdditions\s*=/, '').replace(/;$/, ''));

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'love-tree-envelopes-'));
  const errors = [], network = [];
  const watch = page => {
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  };
  const ready = async (page, url = entry) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 }); await page.evaluate(() => travelTree.ready);
  };
  const freeze = page => page.evaluate(() => {
    const s = travelTree.scene; s.setRunning(false); s.flight = null; s.setRotation(false, 1, 1); s._updateCards(1);
    const view = s.wholeView(.35); s.camera.position.copy(view.pos); s.controls.target.copy(view.target); s.controls.update(); s.renderFirst();
  });
  const fill = async (page, title, body, date = '2026-10-22') => {
    await page.locator('#add-envelope').click(); await page.locator('#envelope-title').fill(title);
    await page.locator('#envelope-body').fill(body); await page.locator('#envelope-date').fill(date);
  };
  const library = async (page, index = 0) => {
    await page.locator('#add-envelope').click();
    await page.locator('.envelope-library').evaluate(el => { el.open = true; }); await page.locator('#envelope-list button').nth(index).click();
  };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true }); watch(page); await ready(page);
    const original = await page.evaluate(() => ({ count: travelTree.catalog.photos.length, positions: travelTree.scene.photos.map(p => [p.id, p.w, p.h, p.rest.toArray()]) }));
    assert.equal(await page.evaluate(() => travelTree.scene.envelopes.entries.length), 0, 'no invented personal letters are seeded');
    await fill(page, '   ', '   '); await page.locator('#envelope-hang').click();
    assert.equal(await page.locator('#envelope-editor').evaluate(el => el.open), true);
    assert.equal(await page.evaluate(() => travelTree.scene.envelopes.entries.length), 0);
    await page.locator('#envelope-title').fill('写给平凡日子里的你');
    const body = '和你一起走过的每一座城市，都藏着我们的故事。\n\n愿往后的晴天和雨天，都有你在我身边。';
    await page.locator('#envelope-body').fill(body); await page.locator('#envelope-hang').click();
    assert.equal(await page.locator('#envelope-editor').evaluate(el => el.open), false);
    assert.equal(await page.evaluate(() => travelTree.scene.envelopes.entries.length), 1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('love-tree:envelopes:v1'))[0].body), body);
    assert.deepEqual(await page.evaluate(() => ({ count: travelTree.catalog.photos.length, positions: travelTree.scene.photos.map(p => [p.id, p.w, p.h, p.rest.toArray()]) })), original, 'adding letters cannot change photos or their layout');
    await freeze(page);
    const hit = await page.evaluate(() => {
      const s = travelTree.scene, e = s.envelopes.entries[0]; s.scene.updateMatrixWorld(true);
      const p = e.pivot.getWorldPosition(s._clusterPoint.clone()).project(s.camera);
      const x = s.rect.left + (p.x + 1) * s.rect.width / 2, y = s.rect.top + (1 - p.y) * s.rect.height / 2;
      return { x, y, id: e.record.id, picked: s.pick(x, y)?.envelope?.id, parent: s.envelopes.group.parent === s.tree, scaleRatio: e.pivot.scale.y * s.tree.scale.y / e.pivot.scale.x };
    });
    assert.equal(hit.picked, hit.id); assert.equal(hit.parent, true); assert.ok(Math.abs(hit.scaleRatio - 1) < 1e-9, 'paper is not stretched by tree height scaling');
    await page.mouse.click(hit.x, hit.y);
    assert.equal(await page.locator('#envelope-reader').evaluate(el => el.open), true);
    assert.equal(await page.evaluate(() => travelTree.scene.running), false, 'tree rendering pauses while reading');
    assert.equal(await page.locator('#envelope-page').isVisible(), false);
    assert.ok(await page.locator('#envelope-stage').evaluate(canvas => canvas.width > 0 && canvas.height > 0));
    await page.waitForFunction(() => !document.getElementById('envelope-page').hidden, null, { timeout: 12000 });
    assert.equal(await page.locator('#envelope-read-body').textContent(), body);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => travelTree.scene.running);
    await page.reload(); await page.waitForFunction(() => window.travelTree); await page.evaluate(() => travelTree.ready);
    assert.equal(await page.evaluate(() => travelTree.scene.envelopes.entries.length), 1, 'refresh restores the hanging letter');

    await library(page); await page.locator('#envelope-skip').click();
    assert.equal(await page.locator('#envelope-edit').count(), 1, 'an existing letter offers an explicit edit action');
    await page.locator('#envelope-edit').click();
    const originalLetter = { id: hit.id, title: '写给平凡日子里的你', recipient: '亲爱的你', date: '2026-10-22', body, signature: '一直喜欢你的我' };
    const fields = async () => page.evaluate(() => Object.fromEntries(['title', 'recipient', 'date', 'body', 'signature'].map(field => [field, document.getElementById('envelope-' + field).value])));
    const { id: originalId, ...originalFields } = originalLetter;
    assert.deepEqual(await fields(), originalFields, 'editing prefills every saved field');
    assert.equal(await page.locator('#envelope-reader').evaluate(el => el.open), false);
    await page.locator('#envelope-title').fill('这份修改先不保存'); await page.locator('#envelope-body').fill('取消后仍是原信。');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('love-tree:envelopes:v1'))), [originalLetter], 'cancelling an edit preserves the original letter');
    await library(page); await page.locator('#envelope-skip').click(); await page.locator('#envelope-edit').click();
    assert.deepEqual(await fields(), originalFields, 'cancelled changes cannot leak into the next edit');
    const editedLetter = { id: originalId, title: '写给一起慢慢变老的你', recipient: '我最亲爱的你', date: '2026-10-21', body: '修改后的第一段。\n\n余生也想和你一起慢慢走。', signature: '永远陪着你的我' };
    for (const [field, value] of Object.entries(editedLetter)) if (field !== 'id') await page.locator('#envelope-' + field).fill(value);
    await page.locator('#envelope-hang').click();
    assert.equal(await page.locator('#envelope-editor').evaluate(el => el.open), false);
    assert.deepEqual(await page.evaluate(() => window.travelTreeAdditions.envelopes), [editedLetter], 'saving edits replaces the same id without adding another letter');
    assert.deepEqual(await page.evaluate(() => travelTree.scene.envelopes.entries.map(e => e.record)), [editedLetter], 'the hanging letter immediately receives the edited content');
    await page.reload(); await page.waitForFunction(() => window.travelTree); await page.evaluate(() => travelTree.ready);
    await library(page); await page.locator('#envelope-skip').click();
    assert.equal(await page.locator('#envelope-reader-heading').textContent(), editedLetter.title);
    for (const field of ['recipient', 'date', 'body', 'signature']) assert.equal(await page.locator('#envelope-read-' + field).textContent(), editedLetter[field], 'edited ' + field + ' survives refresh');
    await page.locator('#envelope-reader-close').click();

    const literal = '<img src=x onerror="window.__letterInjected=1">\n<script>window.__letterInjected=1</script>\n' + '想和你慢慢走过每个春夏秋冬。\n'.repeat(100);
    await fill(page, '给未来的我们', literal, '2025-02-14'); await page.locator('#envelope-hang').click();
    assert.equal(await page.evaluate(() => travelTree.scene.envelopes.entries.length), 2, 'add after editing still creates a separate letter');
    assert.notEqual(await page.evaluate(() => travelTree.scene.envelopes.entries[1].record.id), originalId);
    assert.equal(await page.evaluate(() => travelTree.scene.envelopes.entries[1].record.recipient), '亲爱的你', 'new letters do not inherit the edited recipient');
    await library(page, 1); await page.locator('#envelope-skip').click();
    assert.equal(await page.locator('#envelope-read-body').textContent(), literal);
    assert.equal(await page.locator('#envelope-read-body img, #envelope-read-body script').count(), 0);
    assert.equal(await page.evaluate(() => window.__letterInjected), undefined);
    const close = await page.locator('#envelope-reader-close').boundingBox();
    await page.locator('#envelope-reader .envelope-scroll').evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.deepEqual(await page.locator('#envelope-reader-close').boundingBox(), close, 'close stays fixed while long letters scroll');
    await page.locator('#envelope-reader-close').click();
    const modes = await page.evaluate(() => {
      const s = travelTree.scene, e = s.envelopes.entries[0]; s.setRunning(false);
      s.setAtmosphere(true, true); s._updateCards(.1); const before = e.pivot.rotation.toArray().toString();
      for (let i = 0; i < 12; i++) s._updateCards(.1);
      const moving = before !== e.pivot.rotation.toArray().toString();
      s.setAtmosphere(true, false); s._updateCards(0); const stopped = e.pivot.rotation.toArray().toString(); s._updateCards(.1);
      const staticPose = stopped === e.pivot.rotation.toArray().toString();
      s.setYear(2025); const filtered = s.envelopes.entries.map(e => e.anchor.visible);
      s.setYear(null); s.setLayoutMode('heart', false); const heart = s.envelopes.entries.every(e => e.anchor.visible);
      s.setLayoutMode('carousel', false); s.setClusterMode(true); const clusters = s.envelopes.entries.every(e => e.anchor.visible);
      s.setClusterMode(false); return { moving, staticPose, filtered, heart, clusters };
    });
    assert.deepEqual(modes, { moving: true, staticPose: true, filtered: [false, true], heart: true, clusters: true });

    // File System Access bridge writes exclusively into an in-memory fixture.
    await page.evaluate(() => {
      const data = { ...window.travelTreeAdditions, envelopes: [{ id: 'on-disk', title: '已保存在文件里的信', recipient: '你', body: '保留这封信', signature: '我', date: '2024-01-01' }] };
      const files = window.__envelopeFiles = { 'index.html': 'assets/tree-runtime.js', 'data/user-records.js': 'window.travelTreeAdditions=' + JSON.stringify(data) + ';' };
      const directory = base => ({
        async getDirectoryHandle(name) { return directory(base + name + '/'); },
        async getFileHandle(name, options) {
          const key = base + name;
          if (!(key in files) && !options?.create) throw new DOMException(key, 'NotFoundError');
          return { async getFile() { return new File([files[key]], name); }, async createWritable() { let value; return { async write(v) { value = v; }, async close() { files[key] = value; }, async abort() {} }; } };
        }
      });
      window.showDirectoryPicker = async () => { window.__envelopePickerCalls = (window.__envelopePickerCalls || 0) + 1; return directory(''); };
    });
    await fill(page, '给明天的一封信', '明天也想和你一起吃早餐。'); await page.locator('#envelope-save-project').click();
    await page.waitForFunction(() => document.getElementById('album-status').textContent.includes('已保存到所选'));
    assert.equal(await page.evaluate(() => window.__envelopePickerCalls), 1);
    await page.locator('#album-editor [data-close]').click();
    await library(page); await page.locator('#envelope-skip').click(); await page.locator('#envelope-edit').click();
    const projectEditedBody = '这次修改也要随相册一起带走。';
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key === 'love-tree:envelopes:v1') throw new DOMException('full', 'QuotaExceededError'); return set.call(this, key, value); };
    });
    await page.locator('#envelope-body').fill(projectEditedBody); await page.locator('#envelope-save-project').click();
    await page.waitForFunction(() => !document.getElementById('memory-save').disabled && document.getElementById('album-status').textContent.includes('已保存到所选'));
    assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem('love-tree:envelopes:v1')).find(r => r.id === id).body, originalId), editedLetter.body, 'failed storage leaves the old copy in the browser');
    assert.equal(await page.evaluate(id => window.travelTreeAdditions.envelopes.find(r => r.id === id).body, originalId), projectEditedBody, 'the current edit remains in memory when browser storage fails');
    assert.equal(await page.evaluate(() => window.__envelopePickerCalls), 1, 'editing reuses the selected project folder');
    const saved = parse(await page.evaluate(() => window.__envelopeFiles['data/user-records.js']));
    assert.equal(saved.envelopes.length, 4, 'save retains letters previously on disk and adds all browser letters');
    assert.equal(saved.envelopes.find(r => r.title === '给未来的我们').body, literal);
    assert.deepEqual(saved.envelopes.find(r => r.id === originalId), { ...editedLetter, body: projectEditedBody }, 'project save must retain the latest same-id edit even when browser storage fails');
    const downloadPromise = page.waitForEvent('download'); await page.locator('#memory-export').click(); const download = await downloadPromise;
    const zipped = await fs.readFile(await download.path()); assert.equal(zipped.readUInt32LE(0), 0x04034b50);
    let offset = 0, zipData;
    while (zipped.readUInt32LE(offset) === 0x04034b50) {
      const length = zipped.readUInt32LE(offset + 18), nameLength = zipped.readUInt16LE(offset + 26), extra = zipped.readUInt16LE(offset + 28), start = offset + 30 + nameLength + extra;
      if (zipped.subarray(offset + 30, offset + 30 + nameLength).toString() === 'data/user-records.js') zipData = parse(zipped.subarray(start, start + length).toString());
      offset = start + length;
    }
    assert.equal(zipData.envelopes.length, 4, 'export after folder save also retains letters discovered on disk');
    assert.equal(zipData.envelopes.find(r => r.id === originalId).body, projectEditedBody, 'export includes the latest edit');
    await page.locator('#album-editor [data-close]').click();
    for (let i = 0; i < 3; i++) { await library(page); await page.waitForFunction(() => document.getElementById('envelope-stage-wrap').dataset.phase !== 'sealed'); await page.keyboard.press('Escape'); }

    // A new browser context reopens exported project data with no browser storage.
    for (const directory of ['assets', 'data']) await fs.mkdir(path.join(fixture, directory));
    for (const file of ['index.html', 'assets/start.js', 'assets/tree-runtime.js']) await fs.copyFile(path.join(root, file), path.join(fixture, file));
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jba8AAAAASUVORK5CYII=';
    await fs.writeFile(path.join(fixture, 'data/photos.js'), 'window.travelRingTreeRecords=' + JSON.stringify([{ id: 'base:1', cityKey: 'base', title: '原有城市', year: 2025, src: pixel, aspect: 1 }]) + ';');
    await fs.writeFile(path.join(fixture, 'data/user-records.js'), 'window.travelTreeAdditions=' + JSON.stringify(saved).replace(/</g, '\\u003c') + ';');
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, offline: true, reducedMotion: 'reduce' }); watch(mobile);
    await ready(mobile, pathToFileURL(path.join(fixture, 'index.html')).href);
    assert.equal(await mobile.evaluate(() => travelTree.scene.envelopes.entries.length), 4);
    await library(mobile, 2);
    assert.equal(await mobile.locator('#envelope-page').isVisible(), true, 'reduced motion reveals content without waiting for animation');
    assert.equal(await mobile.locator('#envelope-read-body').textContent(), literal);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.getElementById('envelope-reader').scrollWidth <= document.getElementById('envelope-reader').clientWidth));
    await mobile.locator('#envelope-edit').click();
    assert.equal(await mobile.locator('#envelope-body').inputValue(), literal, 'an imported letter remains editable on mobile');
    await mobile.locator('#envelope-body').fill('手机上修改后取消。'); await mobile.locator('#envelope-editor-close').click();
    await library(mobile, 2);
    assert.equal(await mobile.locator('#envelope-read-body').textContent(), literal, 'closing the mobile editor preserves the imported letter');
    await mobile.keyboard.press('Escape');
    assert.ok(await mobile.evaluate(() => {
      const add = document.getElementById('add-envelope').getBoundingClientRect(), city = document.getElementById('add-city').getBoundingClientRect(), years = document.getElementById('years').getBoundingClientRect();
      return city.right < add.left && add.right <= innerWidth && add.bottom < years.top;
    }), 'both lower-left buttons fit above the mobile year control');
    await mobile.close();
    const blocked = await browser.newPage({ viewport: { width: 390, height: 844 }, offline: true }); watch(blocked);
    await blocked.addInitScript(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key === 'love-tree:envelopes:v1') throw new DOMException('full', 'QuotaExceededError'); return set.call(this, key, value); };
      window.showDirectoryPicker = undefined;
    });
    await ready(blocked, pathToFileURL(path.join(fixture, 'index.html')).href);
    await fill(blocked, '浏览器无法保存时的信', '这封信依然可以导出。'); await blocked.locator('#envelope-hang').click();
    assert.equal(await blocked.locator('#album-editor').evaluate(el => el.open), true, 'blocked storage offers project save/export instead of silently losing the letter');
    assert.ok((await blocked.locator('#album-status').textContent()).includes('不支持直接写入文件夹'));
    assert.equal(await blocked.evaluate(() => window.travelTreeAdditions.envelopes.at(-1).body), '这封信依然可以导出。');
    assert.equal(await blocked.evaluate(() => travelTree.scene.envelopes.entries.length), 5);
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    console.log('PASS: add/validate/hang, edit/prefill/cancel/update same id/refresh/add after edit, actual 3D click, seal/flap/paper animation, exact safe text, fixed close, year/layout/motion, save/export/reopen, mobile reduced motion, context disposal, unchanged photos and offline operation');
  } finally { await browser.close(); console.log('Temporary fixture:', fixture); }
})().catch(error => { console.error(error); process.exitCode = 1; });

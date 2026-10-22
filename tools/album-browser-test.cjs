const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jba8AAAAASUVORK5CYII=', 'base64');
const parse = text => JSON.parse(text.trim().replace(/^window\.travelTreeAdditions=/, '').replace(/;$/, ''));
(async () => {
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), 'love-tree-import-'));
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const dir of ['data', 'assets']) await fs.mkdir(path.join(fixture, dir));
    await fs.copyFile(path.join(root, 'index.html'), path.join(fixture, 'index.html'));
    for (const file of ['tree-runtime.js', 'start.js']) await fs.copyFile(path.join(root, 'assets', file), path.join(fixture, 'assets', file));
    const record = { id: 'original:1', cityKey: 'original', title: '原有城市', year: 2025, date: '2025-02-14', localFile: 'photos/original.png', src: 'data:image/png;base64,' + png.toString('base64'), aspect: 1, visitMonths: ['2025-02'] };
    await fs.writeFile(path.join(fixture, 'data/photos.js'), 'window.travelRingTreeRecords=' + JSON.stringify([record]) + ';');
    await fs.writeFile(path.join(fixture, 'data/user-records.js'), 'window.travelTreeAdditions={"version":1,"records":[],"settings":{},"letters":{},"stories":{}};');
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = [], network = []; page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) network.push(r.url()); });
    await page.exposeFunction('albumFs', async (op, relative, content) => {
      const target = path.resolve(fixture, relative);
      assert.ok(target === fixture || target.startsWith(fixture + path.sep));
      try {
        if (op === 'dir') { await fs.mkdir(target, { recursive: true }); return {}; }
        if (op === 'exists') { await fs.stat(target); return {}; }
        if (op === 'read') return { data: (await fs.readFile(target)).toString('base64') };
        if (op === 'write') { await fs.writeFile(target, Buffer.from(content, 'base64')); return {}; }
      } catch (e) { return { error: e.message, name: e.code === 'ENOENT' ? 'NotFoundError' : 'NotAllowedError' }; }
    });
    await page.addInitScript(() => {
      const rpc = async (...args) => { const r = await window.albumFs(...args); if (r.error) throw new DOMException(r.error, r.name); return r; };
      const directory = base => ({
        async getDirectoryHandle(name, options) { const p = base + name + '/'; await rpc(options?.create ? 'dir' : 'exists', p); return directory(p); },
        async getFileHandle(name, options) {
          const p = base + name; if (!options?.create) await rpc('exists', p);
          return {
            async getFile() { const r = await rpc('read', p); return new File([Uint8Array.from(atob(r.data), c => c.charCodeAt(0))], name); },
            async createWritable() { let value; return { async write(v) { value = v; }, async close() { const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value; let s = ''; for (const b of bytes) s += String.fromCharCode(b); await rpc('write', p, btoa(s)); }, async abort() {} }; }
          };
        }
      });
      window.showDirectoryPicker = async () => directory('');
    });
    const ready = async () => { await page.goto(pathToFileURL(path.join(fixture, 'index.html')).href); await page.waitForFunction(() => window.travelTree); await page.evaluate(() => travelTree.ready); };
    await ready();
    assert.ok(await page.evaluate(() => Math.abs(travelTree.scene.heartScale / .975 - .8) < 1e-9 && Math.abs(travelTree.scene.tree.scale.y / .682 - 1.1) < 1e-9), 'photo geometry stays at its current size and tree height increases another 10%');
    assert.equal(await page.locator('#loading h2').textContent(), '我们的爱情之树相册');
    assert.ok(await page.locator('#opening-photo').getAttribute('src'));
    await page.locator('[data-year="2025"]').click();
    assert.equal(await page.locator('#year-letter').evaluate(el => el.open), true);
    assert.equal(await page.locator('#letter-year').textContent(), '2025');
    const injection = '和你 <script>window.__injected=1</script>';
    await page.locator('#letter-title').fill(injection);
    await page.locator('#letter-body').fill('一起走过的春天。\n下一年，也想和你。');
    await page.locator('#letter-signature').fill('你的另一半');
    await page.locator('#letter-enter').click();
    assert.equal(await page.evaluate(() => travelTree.state.year), 2025);
    assert.equal(await page.locator('#year-route').isVisible(), true);
    await page.locator('#add-city').click();
    await page.locator('#together-date').fill('2025-01-31');
    assert.equal(await page.locator('#month-memories, .months-section').count(), 0);
    assert.ok((await page.locator('#folder-save-help').textContent()).includes('请选择整个项目文件夹'));
    const saveBox = await page.locator('#memory-save').boundingBox(), helpBox = await page.locator('#folder-save-help').boundingBox();
    assert.ok(helpBox.y >= saveBox.y + saveBox.height, 'folder guidance stays below the save button');
    await page.locator('#memory-city').fill('新增心动城');
    await page.locator('#memory-date').fill('2027-03-04');
    await page.locator('#memory-title').fill('第一场春雨');
    await page.locator('#memory-story').fill('我们一起躲过的雨。');
    await page.locator('#memory-files').setInputFiles([{ name: '我们的照片.png', mimeType: 'image/png', buffer: png }]);
    await page.waitForFunction(() => document.querySelectorAll('#upload-previews img').length === 1);
    await page.locator('#upload-previews input').fill('2027-04-05');
    await page.locator('#memory-city').fill('   ');
    await page.locator('#memory-save').click();
    assert.ok((await page.locator('#album-status').textContent()).includes('城市名称'));
    await page.locator('#memory-city').fill('新增心动城');
    await page.evaluate(() => { window.__picker = window.showDirectoryPicker; window.showDirectoryPicker = async () => { throw new DOMException('cancel', 'AbortError'); }; });
    await page.locator('#memory-save').click();
    await page.waitForFunction(() => document.getElementById('album-status').textContent.includes('已取消'));
    assert.equal(await page.locator('#upload-previews img').count(), 1, 'cancelling the picker retains pending photos');
    assert.equal(parse(await fs.readFile(path.join(fixture, 'data/user-records.js'), 'utf8')).records.length, 0);
    await page.evaluate(() => { window.showDirectoryPicker = window.__picker; });
    await page.locator('#memory-save').click();
    await page.waitForFunction(() => !document.getElementById('memory-reload').hidden);
    const manifest = parse(await fs.readFile(path.join(fixture, 'data/user-records.js'), 'utf8'));
    assert.equal(manifest.records.length, 1); assert.equal(manifest.records[0].year, 2027);
    assert.equal(manifest.records[0].date, '2027-04-05');
    assert.deepEqual(await fs.readFile(path.join(fixture, manifest.records[0].localFile)), png, 'folder save retains original image bytes');
    assert.ok(manifest.records[0].localFile.startsWith('photos/2027/新增心动城/'));
    assert.equal(manifest.settings.togetherDate, '2025-01-31'); assert.equal(manifest.letters[2025].title, injection);
    assert.equal(Object.values(manifest.stories)[0].body, '我们一起躲过的雨。');
    // Reopen from saved files in a fresh browser context: no local storage needed.
    const fresh = await browser.newPage({ viewport: { width: 390, height: 844 }, offline: true });
    fresh.on('pageerror', e => errors.push(e.message));
    await fresh.goto(pathToFileURL(path.join(fixture, 'index.html')).href); await fresh.waitForFunction(() => window.travelTree); await fresh.evaluate(() => travelTree.ready);
    assert.equal(await fresh.evaluate(() => travelTree.catalog.photos.length), 2);
    assert.equal(await fresh.evaluate(() => travelTree.catalog.cities.length), 2);
    assert.equal(await fresh.evaluate(() => window.__injected), undefined);
    await fresh.locator('[data-year="2025"]').click();
    assert.equal(await fresh.locator('#letter-title').inputValue(), injection);
    await fresh.keyboard.press('Escape');
    await fresh.locator('[data-year="2027"]').click();
    assert.equal(await fresh.locator('#letter-body').inputValue(), '', 'annual letters remain separate');
    await fresh.locator('#letter-enter').click();
    await fresh.locator('[data-route-city]').click();
    assert.equal(await fresh.locator('#city-memory').evaluate(el => el.open), false);
    assert.equal(await fresh.locator('[data-city-story]').count(), 0, 'city list has no extra story buttons');
    await fresh.locator('#city-story-toggle').click();
    assert.equal(await fresh.locator('#city-memory').evaluate(el => el.open), true);
    assert.equal(await fresh.locator('#city-memory-title').textContent(), '第一场春雨');
    assert.equal(await fresh.locator('#city-memory-body').textContent(), '我们一起躲过的雨。');
    assert.ok(await fresh.evaluate(() => document.getElementById('city-memory-body').getBoundingClientRect().bottom < document.getElementById('city-memory-gallery').getBoundingClientRect().top), 'photos follow story in the large paper dialog');
    assert.equal(await fresh.locator('#city-memory-thumbs button').count(), 1);
    assert.equal(await fresh.locator('#city-memory-next').isDisabled(), true);
    await fresh.locator('#city-memory-close').click();
    await fresh.locator('#story-body').fill('编辑后的城市故事 <img src=x onerror=window.__story=1>');
    await fresh.locator('#city-story-toggle').click();
    assert.ok((await fresh.locator('#city-memory-body').textContent()).includes('编辑后的城市故事'));
    assert.equal(await fresh.locator('#city-memory-body img').count(), 0);
    assert.equal(await fresh.evaluate(() => window.__story), undefined);
    await fresh.keyboard.press('Escape');
    await fresh.locator('#city-photos button').click();
    await fresh.waitForFunction(() => document.getElementById('original-photo').naturalWidth === 1);
    await fresh.keyboard.press('Escape');
    await fresh.locator('[data-year="all"]').click();
    await fresh.locator('#city-toggle').click();
    assert.equal(await fresh.locator('#city-nav [data-city]').count(), 2);
    assert.equal(await fresh.locator('#city-nav [data-city-story]').count(), 0, 'original compact city buttons are preserved');
    await fresh.locator('#city-nav [data-city]').last().click();
    await fresh.locator('#city-story-toggle').click();
    assert.equal(await fresh.locator('#city-memory-body').textContent(), '我们一起躲过的雨。', 'all-years and yearly stories remain separate');
    await fresh.locator('#city-memory-close').click();
    await fresh.locator('#add-city').click();
    assert.equal(await fresh.locator('#together-date').inputValue(), '2025-01-31');
    assert.equal(await fresh.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await fresh.locator('#album-editor').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    // Unsupported browser path still produces a usable original-byte photo package.
    await fresh.evaluate(() => { window.showDirectoryPicker = undefined; });
    await fresh.locator('#memory-save').click();
    assert.ok((await fresh.locator('#album-status').textContent()).includes('不支持'));
    const downloadPromise = fresh.waitForEvent('download'); await fresh.locator('#memory-export').click(); const download = await downloadPromise;
    const zip = await fs.readFile(await download.path()); let offset = 0, entries = new Map();
    while (zip.readUInt32LE(offset) === 0x04034b50) {
      const size = zip.readUInt32LE(offset + 18), length = zip.readUInt16LE(offset + 26), extra = zip.readUInt16LE(offset + 28), name = zip.subarray(offset + 30, offset + 30 + length).toString('utf8'), start = offset + 30 + length + extra;
      entries.set(name, zip.subarray(start, start + size)); offset = start + size;
    }
    assert.deepEqual(entries.get(manifest.records[0].localFile), png);
    assert.equal(parse(entries.get('data/user-records.js').toString('utf8')).letters[2025].title, injection);
    await fresh.close();
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
    console.log('PASS: romantic opening, editable year letters, annual isolation, together date, removed monthly gallery and folder guidance, original-byte folder save, new city/year/photo/story after offline reopen, safe text, mobile and ZIP fallback');
    console.log('Test files retained at:', fixture);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });

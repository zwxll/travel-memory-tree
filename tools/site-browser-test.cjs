const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..'), site = path.join(root, '.pages');

(async () => {
  execFileSync(process.execPath, [path.join(__dirname, 'site-build-test.cjs')], { stdio: 'inherit' });
  const allowed = new Set(['index.html', 'assets/start.js', 'assets/tree-runtime.js', 'data/photos.js', 'data/user-records.js']);
  const base = '/travel-memory-tree/';
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const relative = pathname.startsWith(base) ? pathname.slice(base.length) || 'index.html' : '';
    if (!allowed.has(relative)) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', relative.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    response.end(fs.readFileSync(path.join(site, relative)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [], external = [], missing = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(origin + '/')) external.push(request.url()); });
    page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
    await page.goto(origin + base);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    assert.equal(await page.evaluate(() => travelTree.catalog.photos.length), 72);
    assert.ok(await page.evaluate(() => travelTree.catalog.photos.every(photo => photo.id.startsWith('demo:'))));
    assert.equal(await page.evaluate(() => travelTree.scene.cards.filter(card => card.loaded).length), 72);
    assert.ok((await page.locator('#summary').textContent()).includes('示例画面'));
    assert.equal(await page.evaluate(() => travelTree.scene.envelopes.entries.length), 0);
    await page.locator('#heart-gather').click();
    await page.waitForFunction(() => !travelTree.scene.flight && !travelTree.scene.heartGather);
    assert.equal(await page.evaluate(() => travelTree.scene.layoutMode), 'heart');
    await page.locator('#add-envelope').click();
    await page.locator('#envelope-title').fill('演示信封'); await page.locator('#envelope-body').fill('这是一段浏览器测试文字。');
    await page.locator('#envelope-hang').click();
    const id = await page.evaluate(() => travelTree.scene.envelopes.entries[0].record.id);
    await page.locator('#add-envelope').click();
    await page.locator('.envelope-library').evaluate(details => { details.open = true; });
    await page.locator('#envelope-list button').first().click();
    await page.locator('#envelope-edit').click();
    await page.locator('#envelope-body').fill('演示信封的修改已保存在当前浏览器。'); await page.locator('#envelope-hang').click();
    assert.deepEqual(await page.evaluate(() => travelTree.scene.envelopes.entries.map(entry => ({ id: entry.record.id, body: entry.record.body }))), [{ id, body: '演示信封的修改已保存在当前浏览器。' }]);
    assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(missing, []);
    console.log('PASS: repository subpath serves 72 generated demo cards; heart layout and letter editing work; no missing files or external service requests');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });

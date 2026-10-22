const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('love-tree:atmosphere:v1', JSON.stringify({ night: true, effects: false })));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 }); await page.evaluate(() => travelTree.ready);
    assert.equal(await page.locator('#add-city').textContent(), '＋ 添加城市');
    assert.ok(await page.evaluate(() => {
      const city = getComputedStyle(document.getElementById('add-city')), letter = getComputedStyle(document.getElementById('add-envelope'));
      return city.backgroundColor === letter.backgroundColor && city.color === letter.color && city.borderColor === letter.borderColor;
    }), 'add-city and add-envelope use the same button colors');
    await page.locator('#add-envelope').click(); await page.locator('#envelope-title').fill('把往后的喜欢，都写给你');
    await page.locator('#envelope-body').fill('和你走过的每一座城市，都藏着我们的故事。'); await page.locator('#envelope-hang').click();
    await page.locator('#add-envelope').click(); await page.locator('.envelope-library').evaluate(el => { el.open = true; }); await page.locator('#envelope-list button').click();
    const size = await page.locator('#envelope-stage').boundingBox();
    assert.equal(await page.locator('.envelope-reader-head').isVisible(), false, 'no title block above the animated envelope');
    assert.equal(await page.locator('#envelope-open-status').evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)');
    const openingClose = await page.locator('#envelope-reader-close').boundingBox();
    assert.ok(openingClose.y >= 100 && openingClose.x + openingClose.width < 1200, 'animation close is near the envelope, away from the top-right toolbar');
    assert.equal(await page.locator('#envelope-reader').evaluate(el => {
      const panel = getComputedStyle(el), backdrop = getComputedStyle(el, '::backdrop');
      return panel.backgroundColor === 'rgba(0, 0, 0, 0)' && panel.backgroundImage === 'none' && backdrop.backgroundColor === 'rgba(0, 0, 0, 0)' && backdrop.backdropFilter === 'none';
    }), true, 'opening preserves the main tree background without a dark wash or blur');
    assert.ok(size.width >= 1400 && size.height >= 850, 'the opening is a full-page scene instead of a small dialog preview');
    assert.equal(await page.locator('#envelope-page').isVisible(), false);
    await page.waitForFunction(() => document.getElementById('envelope-stage-wrap').dataset.phase === 'rise', null, { timeout: 7000 });
    assert.equal(await page.locator('#envelope-page').isVisible(), false, 'turning off tree ambient effects must not skip intentional opening animation');
    await page.waitForFunction(() => document.getElementById('envelope-stage-wrap').dataset.phase === 'unfold', null, { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('envelope-stage-wrap').dataset.phase === 'turn', null, { timeout: 5000 });
    await page.waitForFunction(() => !document.getElementById('envelope-page').hidden, null, { timeout: 7000 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#envelope-reader .envelope-scroll')).opacity === '1');
    assert.equal(await page.locator('#envelope-read-body').textContent(), '和你走过的每一座城市，都藏着我们的故事。');
    assert.equal(await page.locator('#envelope-unseal').count(), 0, 'a second opening click is no longer required');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#add-envelope').click(); await page.locator('.envelope-library').evaluate(el => { el.open = true; }); await page.locator('#envelope-list button').click();
    await page.waitForFunction(() => document.getElementById('envelope-stage-wrap').dataset.phase === 'unfold', null, { timeout: 7000 });
    const mobileSize = await page.locator('#envelope-stage').boundingBox(); assert.equal(mobileSize.width, 390); assert.equal(mobileSize.height, 844);
    await page.waitForFunction(() => !document.getElementById('envelope-page').hidden, null, { timeout: 7000 }); await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#add-envelope').click(); await page.locator('.envelope-library').evaluate(el => { el.open = true; }); await page.locator('#envelope-list button').click();
    await page.waitForFunction(() => !document.getElementById('envelope-page').hidden);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.getElementById('envelope-reader').scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log('PASS: automatic full-page seal/rise/unfold/turn opening despite ambient effects disabled; warm paper handoff; mobile reduced motion');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

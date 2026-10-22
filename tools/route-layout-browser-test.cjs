const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
  execFileSync(process.execPath, [path.join(__dirname, 'build-site.cjs')], { stdio: 'inherit' });
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, '.pages/index.html')).href);
    await page.waitForFunction(() => window.travelTree, null, { timeout: 60000 });
    await page.evaluate(() => travelTree.ready);
    const readable = async context => {
      const rows = await page.locator('#route-list li').evaluateAll(items => items.map(item => {
        const stop = item.querySelector('.route-stop'), name = item.querySelector('.route-name'), date = item.querySelector('.route-date'), meta = item.querySelector('.route-meta'), story = item.querySelector('.route-open-story');
        const range = document.createRange(); range.selectNodeContents(name);
        const n = name.getBoundingClientRect(), d = date.getBoundingClientRect(), m = meta.getBoundingClientRect(), b = stop.getBoundingClientRect(), s = story.getBoundingClientRect();
        return { text: name.textContent, lines: range.getClientRects().length, width: n.width, dateBelow: d.top >= n.bottom - 1, metaBelow: m.top >= d.bottom - 1, buttonBelow: s.top >= b.bottom - 1, overflow: [stop, name, date, meta, story].some(element => element.scrollWidth > element.clientWidth + 1) };
      }));
      assert.equal(rows.length, 6, context + ': all demo cities remain in the route');
      for (const row of rows) {
        assert.equal(row.lines, 1, context + ': short city names must stay horizontal: ' + row.text);
        assert.ok(row.width >= 140, context + ': city names have readable space');
        assert.ok(row.dateBelow && row.metaBelow && row.buttonBelow, context + ': dates, visit details and story actions must not crowd city names');
        assert.equal(row.overflow, false, context + ': route text must not overflow its column');
      }
    };
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
      await page.setViewportSize(viewport);
      await page.locator('[data-year="2024"]').click();
      await page.locator('#letter-enter').click();
      await readable(viewport.width + 'px route');
      await page.locator('#route-list .route-stop').first().click();
      await readable(viewport.width + 'px selected city');
      assert.equal(await page.locator('#city-story').isVisible(), true);
      await page.locator('#route-list .route-open-story').first().click();
      assert.equal(await page.locator('#city-memory').evaluate(dialog => dialog.open), true);
      await page.locator('#city-memory-close').click();
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#night-toggle').click();
    await readable('night mode');
    await page.locator('#cities').evaluate(element => { element.scrollTop = 0; });
    await page.locator('#route-list').evaluate(element => { element.scrollTop = 0; });
    const preview = path.join(os.tmpdir(), 'travel-route-layout-fixed.png');
    await page.locator('#cities').screenshot({ path: preview });
    assert.deepEqual(errors, []);
    console.log('PASS: readable route typography without overlap at 1440/1280/390/320px, before and after city selection, story actions and night mode; preview: ' + preview);
  } catch (error) {
    if (page) {
      const preview = path.join(os.tmpdir(), 'travel-route-layout-failure.png');
      await page.locator('#cities').screenshot({ path: preview });
      console.error('Route preview:', preview);
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

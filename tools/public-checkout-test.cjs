const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..'), fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'public-memory-tree-'));
  execFileSync('git', ['checkout-index', '--all', '--prefix=' + fixture.replace(/\\/g, '/') + '/'], { cwd: root });
  for (const name of ['photos', 'data/photos.js', 'data/user-records.js', 'data/catalog.json']) assert.equal(fs.existsSync(path.join(fixture, name)), false, 'public checkout excludes ' + name);
  execFileSync(process.execPath, ['tools/setup-local-data.cjs'], { cwd: fixture, stdio: 'inherit' });
  const sandbox = { window: {} };
  for (const name of ['photos', 'user-records']) vm.runInNewContext(fs.readFileSync(path.join(fixture, 'data', name + '.js'), 'utf8'), sandbox);
  assert.equal(sandbox.window.travelRingTreeRecords.length, 0);
  assert.equal(sandbox.window.travelTreeAdditions.envelopes.length, 0);
  const saved = fs.readFileSync(path.join(fixture, 'data/user-records.js'));
  execFileSync(process.execPath, ['tools/setup-local-data.cjs'], { cwd: fixture, stdio: 'inherit' });
  assert.deepEqual(fs.readFileSync(path.join(fixture, 'data/user-records.js')), saved, 'initialization preserves existing local records');
  execFileSync(process.execPath, ['tools/test.cjs'], { cwd: fixture, stdio: 'inherit' });
  execFileSync(process.execPath, ['src/assets/travel-ring-tree/build-embedded.cjs', require.resolve('esbuild')], { cwd: fixture, stdio: 'inherit' });
  const hash = directory => createHash('sha256').update(fs.readFileSync(path.join(directory, 'assets/tree-runtime.js'))).digest('hex');
  assert.equal(hash(fixture), hash(root), 'a clean checkout rebuilds the same runtime across line endings');
  assert.equal(fs.existsSync(path.join(fixture, 'src/assets/travel-ring-tree/embedded.js')), false);
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ offline: true }), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(fixture, 'index.html')).href);
    await page.waitForFunction(() => window.travelTree);
    await page.evaluate(() => travelTree.ready);
    assert.equal(await page.evaluate(() => travelTree.catalog.photos.length), 0);
    await page.locator('#add-city').click();
    assert.equal(await page.locator('#album-editor').evaluate(dialog => dialog.open), true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
  console.log('PASS: public checkout has no private data; empty setup, non-overwrite, core tests, reproducible rebuild and offline import all work');
})().catch(error => { console.error(error); process.exitCode = 1; });

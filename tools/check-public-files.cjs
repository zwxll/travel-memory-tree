const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const publicData = new Set(['data/README.md', 'data/photos.example.js', 'data/user-records.example.js']);
const approvedScreenshots = new Set([
  'docs/previews/carousel-night.png', 'docs/previews/city-editor.png',
  'docs/previews/envelope-editor.png', 'docs/previews/envelope-animation.png',
  'docs/previews/letter-reader.png', 'docs/previews/heart-layout.png'
]);
const publicDocs = new Set(['docs/THREE-LICENSE.txt', 'docs/THIRD_PARTY_NOTICES.md', ...approvedScreenshots]);
const localTests = new Set(['tools/year-story-browser-test.cjs', 'tools/love-browser-test.cjs']);

assert.ok(files.length, 'Stage the public files before checking the upload.');
for (const file of files) {
  assert.ok(!file.startsWith('photos/') && !file.startsWith('.local/') && !file.startsWith('.pages/'), 'Private or generated directory tracked: ' + file);
  assert.ok(!file.startsWith('data/') || publicData.has(file), 'Private album data tracked: ' + file);
  assert.ok(!file.startsWith('docs/') || publicDocs.has(file), 'Local report tracked: ' + file);
  assert.ok(!localTests.has(file), 'Private travel fixture tracked: ' + file);
  assert.ok(!/(^|\/)(?:node_modules|\.env(?:\.[^/]+)?)(\/|$)/.test(file), 'Local dependency or secret file tracked: ' + file);
  assert.ok(approvedScreenshots.has(file) || !/\.(?:png|jpe?g|webp|heic|gif|mp4|mov|zip)$/i.test(file), 'Unapproved media or archive tracked: ' + file);
  const bytes = execFileSync('git', ['show', ':' + file], { cwd: root, maxBuffer: 4 * 1024 * 1024 });
  if (approvedScreenshots.has(file)) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Approved screenshot must be a PNG: ' + file);
    continue;
  }
  const contents = bytes.toString();
  assert.ok(!/data:image\/[^;,]+;base64,[A-Za-z0-9+/=]{1024,}/.test(contents), 'Embedded photo tracked: ' + file);
  assert.ok(!/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/.test(contents), 'GitHub credential tracked: ' + file);
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(contents), 'Private key tracked: ' + file);
}
console.log('PASS: ' + files.length + ' staged public files; only approved screenshots allowed; private data, other media, archives and credentials excluded');

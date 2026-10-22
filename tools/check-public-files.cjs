const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const publicData = new Set(['data/README.md', 'data/photos.example.js', 'data/user-records.example.js']);
const publicDocs = new Set(['docs/THREE-LICENSE.txt', 'docs/THIRD_PARTY_NOTICES.md']);
const localTests = new Set(['tools/year-story-browser-test.cjs', 'tools/love-browser-test.cjs']);

assert.ok(files.length, 'Stage the public files before checking the upload.');
for (const file of files) {
  assert.ok(!file.startsWith('photos/') && !file.startsWith('.local/'), 'Private directory tracked: ' + file);
  assert.ok(!file.startsWith('data/') || publicData.has(file), 'Private album data tracked: ' + file);
  assert.ok(!file.startsWith('docs/') || publicDocs.has(file), 'Local report tracked: ' + file);
  assert.ok(!localTests.has(file), 'Private travel fixture tracked: ' + file);
  assert.ok(!/(^|\/)(?:node_modules|\.env(?:\.[^/]+)?)(\/|$)/.test(file), 'Local dependency or secret file tracked: ' + file);
  assert.ok(!/\.(?:png|jpe?g|webp|heic|gif|mp4|mov|zip)$/i.test(file), 'Personal media or archive tracked: ' + file);
  const contents = execFileSync('git', ['show', ':' + file], { cwd: root, maxBuffer: 4 * 1024 * 1024 }).toString();
  assert.ok(!/data:image\/[^;,]+;base64,[A-Za-z0-9+/=]{1024,}/.test(contents), 'Embedded photo tracked: ' + file);
  assert.ok(!/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/.test(contents), 'GitHub credential tracked: ' + file);
  assert.ok(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(contents), 'Private key tracked: ' + file);
}
console.log('PASS: ' + files.length + ' staged public files; private data, media, archives and credentials excluded');

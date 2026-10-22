const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
assert.ok(fs.existsSync(path.join(root, 'index.html')), '必须提供可双击打开的入口');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'data/photos.js'), 'utf8'), sandbox);
const records = sandbox.window.travelRingTreeRecords;
assert.equal(records.length, 164);
assert.equal(new Set(records.map(r => r.cityKey)).size, 27);
assert.equal(new Set(records.map(r => r.id)).size, records.length);
for (const r of records) {
  const file = path.resolve(root, r.localFile);
  assert.ok(file.startsWith(root + path.sep));
  const image = fs.readFileSync(file);
  assert.equal(crypto.createHash('sha256').update(image).digest('hex'), r.sha256);
  assert.deepEqual(image, Buffer.from(r.src.split(',')[1], 'base64'));
  assert.ok(r.aspect > 0);
}
console.log('PASS: 164 张照片、27 个城市、照片完整性及离线数据一致');

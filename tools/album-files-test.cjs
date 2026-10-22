const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const source = await fs.readFile(path.join(__dirname, '../src/assets/travel-ring-tree/album-files.js'), 'utf8');
  const { saveAdditions, additionsScript, additionsZip, parseAdditions, emptyAdditions } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const old = { ...emptyAdditions(), records: [{ id: 'old' }] };
  let files = new Map([['index.html', 'assets/tree-runtime.js'], ['data/user-records.js', additionsScript(old)]]), fail = false;
  const directory = prefix => ({
    async getDirectoryHandle(name) { return directory(prefix + name + '/'); },
    async getFileHandle(name, options) {
      const key = prefix + name;
      if (!files.has(key) && !options?.create) throw Object.assign(new Error(key), { name: 'NotFoundError' });
      return { async getFile() { return { async text() { return files.get(key); } }; }, async createWritable() { let value; return { async write(v) { if (fail && key.startsWith('photos/')) throw new Error('disk full'); value = v; }, async close() { files.set(key, value); }, async abort() {} }; } };
    }
  });
  const photo = { id: 'new', localFile: 'photos/2027/城市/p.png', src: 'data:image/png;base64,AQID' };
  const data = { ...emptyAdditions(), records: [photo], letters: { 2027: { body: '</script>' } } };
  const root = directory('');
  const merged = await saveAdditions(root, data, [photo]);
  assert.deepEqual(merged.records.map(r => r.id), ['old', 'new']);
  assert.deepEqual([...files.get(photo.localFile)], [1, 2, 3]);
  assert.equal(parseAdditions(files.get('data/user-records.js')).letters[2027].body, '</script>');
  assert.equal(files.get('data/user-records.js').includes('</script>'), false);
  const before = files.get('data/user-records.js'); fail = true;
  await assert.rejects(saveAdditions(root, data, [photo]), /disk full/);
  assert.equal(files.get('data/user-records.js'), before, 'failed photo writes must not publish a new manifest');
  fail = false; files.set('data/user-records.js', 'malformed');
  await assert.rejects(saveAdditions(root, data, [photo]), /格式/);
  assert.equal(files.get('data/user-records.js'), 'malformed', 'unrecognized manifests must be preserved');
  files.set('index.html', 'another project');
  await assert.rejects(saveAdditions(root, data, [photo]), /请选择/);
  assert.equal(files.get('data/user-records.js'), 'malformed');
  const zip = Buffer.from(await additionsZip(data).arrayBuffer());
  const fileNameLength = zip.readUInt16LE(26), crc = zip.readUInt32LE(14);
  assert.equal(crc, 0x55bc801d, 'ZIP CRC32 must match original bytes 01 02 03');
  assert.equal(zip.subarray(30, 30 + fileNameLength).toString(), photo.localFile);
  console.log('PASS: merge existing imports, original bytes, safe manifest text, failed/corrupt/wrong-folder preservation and standard ZIP CRC32');
})().catch(e => { console.error(e); process.exitCode = 1; });

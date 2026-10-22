const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const load = async name => import('data:text/javascript;base64,' + Buffer.from(await fs.readFile(path.join(__dirname, '../src/assets/travel-ring-tree/', name), 'utf8')).toString('base64'));
(async () => {
  const { saveAdditions, additionsScript, additionsZip, parseAdditions } = await load('album-files.js');
  const original = { id: 'first', title: '给你', recipient: '亲爱的', body: '第一行\n第二行  ', signature: '我', date: '2026-10-22' };
  const updated = { ...original, title: '  重新写给你  ', body: '</script><script>throw new Error("must remain text")</script>\n爱你。' };
  const second = { ...original, id: 'second', title: '另一封信', date: '2024-02-29' };
  const files = new Map([['index.html', 'assets/tree-runtime.js'], ['data/user-records.js', additionsScript({ version: 1, records: [], envelopes: [original] })]]);
  const directory = prefix => ({
    async getDirectoryHandle(name) { return directory(prefix + name + '/'); },
    async getFileHandle(name, options) {
      const key = prefix + name;
      if (!files.has(key) && !options?.create) throw Object.assign(new Error(key), { name: 'NotFoundError' });
      return { async getFile() { return { async text() { return files.get(key); } }; }, async createWritable() { let value; return { async write(v) { value = v; }, async close() { files.set(key, value); }, async abort() {} }; } };
    }
  });
  const root = directory('');
  const cityOnly = { version: 1, records: [], letters: { 2026: { body: '年轮信保持独立' } } };
  const preserved = await saveAdditions(root, cityOnly, []);
  assert.deepEqual(preserved.envelopes, [original], 'saving a city from an older page must retain envelopes already on disk');
  const merged = await saveAdditions(root, { ...cityOnly, envelopes: [updated, second] }, []);
  assert.deepEqual(merged.envelopes, [updated, second], 'incoming envelopes replace matching ids without losing other letters');
  const reopened = parseAdditions(files.get('data/user-records.js'));
  assert.deepEqual(reopened.envelopes, [updated, second], 'saving and reopening must retain exact envelope text');
  assert.deepEqual(reopened.letters, { 2026: { body: '年轮信保持独立' } });
  assert.equal(reopened.version, 1);
  assert.equal(files.get('data/user-records.js').includes('</script>'), false, 'manifest text must not close its script element');
  const zip = Buffer.from(await additionsZip(reopened).arrayBuffer());
  let offset = 0, zipManifest;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const length = zip.readUInt32LE(offset + 18), nameLength = zip.readUInt16LE(offset + 26), extraLength = zip.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    if (zip.subarray(offset + 30, offset + 30 + nameLength).toString() === 'data/user-records.js') zipManifest = zip.subarray(start, start + length).toString();
    offset = start + length;
  }
  assert.deepEqual(parseAdditions(zipManifest).envelopes, [updated, second], 'ZIP export must retain all envelope fields');
  files.set('data/user-records.js', additionsScript({ version: 1, records: [] }));
  const legacy = await saveAdditions(root, cityOnly, []);
  assert.deepEqual(legacy.envelopes, [], 'version 1 manifests without envelopes must still save');
  files.set('data/user-records.js', additionsScript({ version: 1, records: [], envelopes: {} }));
  assert.deepEqual((await saveAdditions(root, cityOnly, [])).envelopes, [], 'a malformed optional envelope list must not break city saves');

  const { readEnvelopes, persistEnvelopes } = await load('envelope-store.js');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const key = 'love-tree:envelopes:v1', rows = new Map([['unrelated', 'untouched']]);
  const storage = { getItem: name => rows.get(name) ?? null, setItem: (name, value) => rows.set(name, String(value)) };
  const install = value => Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
  try {
    install(storage);
    assert.deepEqual(readEnvelopes(), []);
    assert.deepEqual(readEnvelopes([original]), [original]);
    const draft = Object.freeze({ ...updated, extra: 'do not store' });
    assert.equal(persistEnvelopes(Object.freeze([draft, second])), true);
    assert.deepEqual(JSON.parse(rows.get(key)), [updated, second], 'persist only the envelope contract and retain literal text');
    assert.deepEqual(readEnvelopes([original]), [updated, second], 'browser values override imported envelopes by id');
    assert.equal(draft.extra, 'do not store', 'persistence must not mutate editor records');
    assert.equal(rows.get('unrelated'), 'untouched');
    const invalid = [null, [], false, 7, 'text', {}, { ...original, id: '' }, { ...original, body: 9 }, { ...original, recipient: null }, { ...original, date: '2026-02-30' }, { ...original, date: '2026-2-3' }];
    assert.deepEqual(readEnvelopes([null, original, ...invalid]), [updated, second], 'malformed imported rows cannot hide a valid local record');
    for (const value of invalid) {
      const before = rows.get(key);
      assert.equal(persistEnvelopes([value]), false, 'invalid drafts must not overwrite saved letters');
      assert.equal(rows.get(key), before);
    }
    assert.equal(persistEnvelopes({}), false);
    rows.set(key, JSON.stringify([null, { ...original, date: '2026-02-30' }, second]));
    assert.deepEqual(readEnvelopes([original]), [original, second], 'invalid local rows must be skipped individually');
    for (const value of ['{unfinished', 'null', '{}', '42', '"old data"']) {
      rows.set(key, value); assert.deepEqual(readEnvelopes([original]), [original], 'corrupt or legacy storage must preserve imported records');
    }
    assert.deepEqual(readEnvelopes({}), []);
    install({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota exceeded'); } });
    assert.deepEqual(readEnvelopes([original]), [original]);
    assert.equal(persistEnvelopes([original]), false, 'storage failures must be reported without losing the editor draft');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('privacy mode'); } });
    assert.deepEqual(readEnvelopes([original]), [original]); assert.equal(persistEnvelopes([original]), false);
    delete globalThis.localStorage;
    assert.deepEqual(readEnvelopes([original]), [original]); assert.equal(persistEnvelopes([original]), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage;
  }
  console.log('PASS: envelope persistence, exact text, id merging, malformed data, blocked storage, save/reopen, legacy manifests and ZIP roundtrip');
})().catch(error => { console.error(error); process.exitCode = 1; });

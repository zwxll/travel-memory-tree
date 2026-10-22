const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/assets/travel-ring-tree/story-store.js'), 'utf8');
  const { readStory, writeStory } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const rows = new Map([['photos', 'untouched photos'], ['catalog', 'untouched records']]);
  const storage = { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, String(value)) };
  const install = value => Object.defineProperty(globalThis, 'localStorage', { configurable: true, value });
  const empty = { title: '', body: '' };
  try {
    install(storage);
    assert.deepEqual(readStory(2026, '北京'), empty, 'an unsaved city starts with an empty story');
    const draft = Object.freeze({ title: '  夏天的北京  ', body: '第一行\n第二行  ', photos: 'do not store' });
    assert.equal(writeStory(2026, '北京', draft), true, 'valid stories must persist successfully');
    assert.deepEqual(readStory(2026, '北京'), { title: '  夏天的北京  ', body: '第一行\n第二行  ' }, 'story text must round-trip without trimming or losing newlines');
    assert.deepEqual(draft, { title: '  夏天的北京  ', body: '第一行\n第二行  ', photos: 'do not store' }, 'autosave must leave the editor draft unchanged');
    assert.equal(rows.get('photos'), 'untouched photos'); assert.equal(rows.get('catalog'), 'untouched records');
    const savedKey = [...rows.keys()].find(key => key.startsWith('love-tree:story:v1:'));
    assert.deepEqual(JSON.parse(rows.get(savedKey)), { title: '  夏天的北京  ', body: '第一行\n第二行  ' }, 'persist only title and body');
    writeStory(2025, '北京', { title: '去年', body: '旧故事' });
    writeStory(2026, '开封', { title: '另一城', body: '新故事' });
    assert.equal(readStory(2025, '北京').title, '去年'); assert.equal(readStory(2026, '北京').title, '  夏天的北京  ');
    assert.equal(readStory(2026, '开封').title, '另一城', 'stories must be isolated by both city and year');
    writeStory(null, '北京', { title: '全部年份', body: '共同回忆' });
    assert.deepEqual(readStory(undefined, '北京'), { title: '全部年份', body: '共同回忆' }, 'null and undefined use the all-years story');
    writeStory(0, '北京', { title: '零', body: '' }); assert.equal(readStory(null, '北京').title, '全部年份', 'only nullish years use all');
    writeStory(2026, 'a:b', { title: 'colon city', body: '' });
    writeStory('2026:a', 'b', { title: 'colon year', body: '' });
    assert.equal(readStory(2026, 'a:b').title, 'colon city'); assert.equal(readStory('2026:a', 'b').title, 'colon year');
    assert.ok(rows.has('love-tree:story:v1:2026:a%3Ab'), 'encode key components so separators cannot collide');
    const corruptedKey = 'love-tree:story:v1:2026:broken';
    rows.set(corruptedKey, '{unfinished'); assert.deepEqual(readStory(2026, 'broken'), empty, 'bad JSON must not break the editor');
    for (const value of [null, [], false, 42, 'text', { title: 'title only' }, { body: 'body only' }, { title: 9, body: 'text' }, { title: 'text', body: null }]) {
      rows.set(corruptedKey, JSON.stringify(value)); assert.deepEqual(readStory(2026, 'broken'), empty, 'both stored fields must be strings');
    }
    rows.set(corruptedKey, JSON.stringify({ title: 'valid', body: 'text', record: 'ignore' }));
    assert.deepEqual(readStory(2026, 'broken'), { title: 'valid', body: 'text' });
    assert.equal(writeStory(2026, 'broken', { title: 5, body: '' }), false, 'invalid drafts must not replace a valid story');
    assert.deepEqual(readStory(2026, 'broken'), { title: 'valid', body: 'text' });
    install({ getItem() { throw new Error('read blocked'); }, setItem: storage.setItem });
    assert.deepEqual(readStory(2026, '北京'), empty, 'blocked reads return an empty story');
    install({ getItem: storage.getItem, setItem() { throw new Error('quota exceeded'); } });
    const unsaved = Object.freeze({ title: '留在编辑器', body: '尚未保存的文本' });
    assert.equal(writeStory(2026, '北京', unsaved), false, 'failed autosave must be reported');
    assert.deepEqual(unsaved, { title: '留在编辑器', body: '尚未保存的文本' });
    assert.equal(readStory(2026, '北京').title, '  夏天的北京  ', 'failed writes retain the previously saved story');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('privacy mode'); } });
    assert.deepEqual(readStory(2026, '北京'), empty); assert.equal(writeStory(2026, '北京', unsaved), false, 'storage access itself may throw');
    delete globalThis.localStorage;
    assert.deepEqual(readStory(2026, '北京'), empty); assert.equal(writeStory(2026, '北京', unsaved), false, 'missing storage must also remain safe');
    console.log('PASS: story persistence, exact text, year/city isolation, safe keys, corrupt data, blocked storage and failed autosave');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous); else delete globalThis.localStorage;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

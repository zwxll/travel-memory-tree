// Originals are kept byte-for-byte beside the existing photo archive.
export const emptyAdditions = () => ({ version: 1, records: [], settings: {}, letters: {}, stories: {}, envelopes: [] });
export function additionsScript(data) {
  return 'window.travelTreeAdditions=' + JSON.stringify(data).replace(/</g, '\\u003c') + ';\n';
}
export function parseAdditions(text) {
  const match = text.match(/^\s*window\.travelTreeAdditions\s*=([\s\S]*);\s*$/);
  if (!match) throw new Error('新增资料文件格式无法识别，未覆盖原文件。');
  const data = JSON.parse(match[1]);
  if (data.version !== 1 || !Array.isArray(data.records)) throw new Error('新增资料版本无法识别，未覆盖原文件。');
  return data;
}
export async function imageRecord(file, { city, cityKey, date }) {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) throw new Error('请选择 JPG、PNG、WebP、GIF 或 AVIF 照片。');
  const src = await new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('照片读取失败，请重试。')); reader.readAsDataURL(file);
  });
  const image = new Image(); image.src = src;
  try { await image.decode(); } catch { throw new Error(`无法读取照片：${file.name}`); }
  const id = crypto.randomUUID(), ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[file.type];
  const folder = city.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '') || '心动城市';
  const localFile = `photos/${date.slice(0, 4)}/${folder}/${id}.${ext}`;
  return { id: `${cityKey}:${id}`, cityKey, title: city, sourceFile: file.name, localFile, full: localFile, src, aspect: image.naturalWidth / image.naturalHeight, year: Number(date.slice(0, 4)), date, dateSource: 'manual', visitYears: [Number(date.slice(0, 4))], visitMonths: [date.slice(0, 7)] };
}
function originalBytes(record) {
  const binary = atob(record.src.split(',')[1]);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function writeFile(directory, name, contents) {
  const file = await directory.getFileHandle(name, { create: true }), writable = await file.createWritable();
  try { await writable.write(contents); await writable.close(); }
  catch (error) { await writable.abort().catch(() => {}); throw error; }
}
export async function saveAdditions(root, data, newRecords) {
  const entry = await (await root.getFileHandle('index.html')).getFile();
  if (!(await entry.text()).includes('assets/tree-runtime.js')) throw new Error('请选择包含 index.html、photos 和 data 的爱情相册文件夹。');
  const directory = await root.getDirectoryHandle('data');
  let stored = emptyAdditions();
  try { stored = parseAdditions(await (await (await directory.getFileHandle('user-records.js')).getFile()).text()); }
  catch (error) { if (error.name !== 'NotFoundError') throw error; }
  // Re-read disk so another save cannot silently discard existing imported photos.
  const records = [...new Map([...stored.records, ...data.records].map(record => [record.id, record])).values()];
  const envelopes = [...new Map([...(Array.isArray(stored.envelopes) ? stored.envelopes : []), ...(Array.isArray(data.envelopes) ? data.envelopes : [])].filter(record => record && typeof record.id === 'string').map(record => [record.id, record])).values()];
  for (const record of newRecords) {
    const parts = record.localFile.split('/');
    if (parts[0] !== 'photos' || parts.some(part => !part || part === '.' || part === '..')) throw new Error('照片保存路径无效。');
    let folder = root;
    for (const part of parts.slice(0, -1)) folder = await folder.getDirectoryHandle(part, { create: true });
    await writeFile(folder, parts.at(-1), originalBytes(record));
  }
  const merged = { ...data, records, envelopes };
  // Publish the manifest last: an interrupted copy never exposes incomplete records.
  await writeFile(directory, 'user-records.js', additionsScript(merged));
  return merged;
}
// Small, uncompressed ZIP writer: no runtime dependency or network requests.
export function additionsZip(data) {
  const encoder = new TextEncoder(), files = data.records.map(record => [record.localFile, originalBytes(record)]);
  files.push(['data/user-records.js', encoder.encode(additionsScript(data))]);
  const table = Uint32Array.from({ length: 256 }, (_, n) => {
    for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const chunks = [], entries = []; let offset = 0;
  for (const [path, bytes] of files) {
    const name = encoder.encode(path); let crc = 0xffffffff;
    for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = new Uint8Array(30), l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true); l.setUint16(6, 0x800, true);
    l.setUint16(12, 33, true); l.setUint32(14, crc, true); l.setUint32(18, bytes.length, true); l.setUint32(22, bytes.length, true); l.setUint16(26, name.length, true);
    const central = new Uint8Array(46), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, bytes.length, true); c.setUint32(24, bytes.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
    chunks.push(local, name, bytes); entries.push(central, name); offset += local.length + name.length + bytes.length;
  }
  const length = entries.reduce((sum, entry) => sum + entry.length, 0), end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, length, true); e.setUint32(16, offset, true);
  return new Blob([...chunks, ...entries, end], { type: 'application/zip' });
}

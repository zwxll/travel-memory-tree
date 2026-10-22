import { emptyAdditions, imageRecord, saveAdditions, additionsZip } from './album-files.js';
import { writeStory } from './story-store.js';
import { readEnvelopes } from './envelope-store.js';

const $ = id => document.getElementById(id), storageKey = 'love-tree:album:v1';
export function buildLoveAlbum(catalog, syncRunning) {
  let additions = window.travelTreeAdditions || emptyAdditions();
  let saved = { settings: additions.settings || {}, letters: additions.letters || {} };
  try {
    const local = JSON.parse(localStorage.getItem(storageKey));
    if (local) saved = { settings: { ...saved.settings, ...local.settings }, letters: { ...saved.letters, ...local.letters } };
    for (const [key, value] of Object.entries(additions.stories || {})) if (key.startsWith('love-tree:story:v1:') && !localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value));
  } catch { /* Edits stay in memory when browser storage is unavailable. */ }
  let pending = [], activeYear = null, folder = null, busy = false;
  const persist = () => {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); return true; } catch { return false; }
  };
  const open = dialog => { dialog.showModal(); syncRunning(); };
  for (const dialog of [$('album-editor'), $('year-letter')]) {
    dialog.addEventListener('close', syncRunning);
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => { if (e.target === dialog && !busy) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
  }
  $('together-date').value = saved.settings.togetherDate || '';
  function updateTogether() {
    const start = saved.settings.togetherDate;
    if (!start) { $('together-summary').textContent = '选一个日子，作为我们故事的开始。'; return; }
    const days = Math.floor((Date.now() - new Date(start + 'T00:00:00').getTime()) / 86400000);
    $('together-summary').textContent = days >= 0 ? `从 ${start} 开始，我们已一起走过 ${days + 1} 天。` : `距离约定的 ${start}，还有 ${Math.abs(days)} 天。`;
  }
  $('together-date').addEventListener('input', () => {
    saved.settings.togetherDate = $('together-date').value;
    const ok = persist(); updateTogether(); $('album-status').textContent = ok ? '在一起的日期已保存在本浏览器。' : '日期暂存于本次页面，请保存到相册文件夹。';
  });
  $('add-city').addEventListener('click', () => {
    $('album-status').textContent = ''; updateTogether(); open($('album-editor'));
  });
  $('memory-date').value = new Date().toLocaleDateString('sv-SE');
  $('memory-date').addEventListener('change', () => {
    const date = $('memory-date').value;
    if (!date || !pending.length) return;
    for (const photo of pending) { photo.date = date; photo.year = Number(date.slice(0, 4)); photo.visitYears = [photo.year]; photo.visitMonths = [date.slice(0, 7)]; }
    renderUploads();
  });
  $('city-options').replaceChildren(...catalog.cities.map(city => new Option(city.title)));
  $('memory-files').addEventListener('change', async () => {
    $('album-status').textContent = '正在读取原始照片…'; $('memory-save').disabled = true;
    pending = []; $('upload-previews').replaceChildren();
    const city = $('memory-city').value.trim(), date = $('memory-date').value;
    if (!city || !date) { $('album-status').textContent = '请先填写城市和回忆日期，再选择照片。'; $('memory-files').value = ''; $('memory-save').disabled = false; return; }
    try {
      const cityKey = catalog.cities.find(c => c.title === city)?.id || `love-${crypto.randomUUID()}`;
      for (const file of $('memory-files').files) pending.push(await imageRecord(file, { city, cityKey, date }));
      renderUploads(); $('album-status').textContent = `已准备 ${pending.length} 张原图，还未写入相册文件夹。`;
    } catch (error) { pending = []; $('memory-files').value = ''; $('album-status').textContent = error.message; }
    finally { $('memory-save').disabled = false; }
  });
  function renderUploads() {
    $('upload-previews').replaceChildren(...pending.map((photo, index) => {
      const card = document.createElement('article'), image = document.createElement('img'); image.src = photo.src; image.alt = photo.sourceFile;
      const name = document.createElement('span'); name.textContent = photo.sourceFile;
      const label = document.createElement('label'); label.textContent = '这张照片的回忆日期';
      const date = document.createElement('input'); date.type = 'date'; date.required = true; date.value = photo.date; date.setAttribute('aria-label', `第 ${index + 1} 张照片日期`);
      date.addEventListener('change', () => { if (date.value) { photo.date = date.value; photo.year = Number(date.value.slice(0, 4)); photo.visitYears = [photo.year]; photo.visitMonths = [date.value.slice(0, 7)]; } });
      label.append(date); card.append(image, name, label); return card;
    }));
  }
  function snapshot() {
    const city = $('memory-city').value.trim();
    const existing = catalog.cities.find(c => c.title === city);
    for (const photo of pending) {
      photo.title = city; if (existing) photo.cityKey = existing.id;
      const folderName = city.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '') || '心动城市';
      photo.localFile = `photos/${photo.year}/${folderName}/${photo.localFile.split('/').at(-1)}`; photo.full = photo.localFile;
    }
    const stories = { ...additions.stories };
    try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith('love-tree:story:v1:')) stories[key] = JSON.parse(localStorage.getItem(key)); } } catch { /* Saved imported stories remain available. */ }
    if (pending.length && ($('memory-title').value.trim() || $('memory-story').value.trim())) {
      const story = { title: $('memory-title').value, body: $('memory-story').value };
      for (const photo of pending) for (const year of [photo.year, 'all']) {
        stories['love-tree:story:v1:' + encodeURIComponent(year) + ':' + encodeURIComponent(photo.cityKey)] = story;
        writeStory(year === 'all' ? null : year, photo.cityKey, story);
      }
    }
    const envelopes = [...new Map([...readEnvelopes(additions.envelopes), ...(window.travelTreeAdditions?.envelopes || [])].map(record => [record.id, record])).values()];
    return { version: 1, records: [...(additions.records || []), ...pending], settings: saved.settings, letters: saved.letters, stories, envelopes };
  }
  function valid() {
    if (pending.length && !$('memory-city').value.trim()) { $('album-status').textContent = '请填写城市名称。'; $('memory-city').focus(); return false; }
    if (pending.length && (!$('memory-city').reportValidity() || !$('memory-date').reportValidity())) return false;
    if (pending.length && [...$('upload-previews').querySelectorAll('input')].some(input => !input.reportValidity())) return false;
    return true;
  }
  async function saveFolder() {
    if (!valid()) return;
    if (!window.showDirectoryPicker) { $('album-status').textContent = '当前浏览器不支持直接写入文件夹。请下载新增资料包，解压到本相册文件夹后重新打开。'; return; }
    busy = true; $('memory-save').disabled = $('memory-export').disabled = true;
    try {
      // The picker must run directly inside the user's click gesture.
      if (!folder) folder = await showDirectoryPicker({ mode: 'readwrite', id: 'love-tree-album' });
      $('album-status').textContent = '正在保存原图、回忆和树上来信，请保持页面打开…';
      additions = await saveAdditions(folder, snapshot(), pending); persist();
      $('album-status').textContent = '已保存到所选相册文件夹。重新打开该文件夹的 index.html 即可查看。';
      $('memory-reload').hidden = false; pending = []; $('memory-files').value = ''; renderUploads();
    } catch (error) {
      folder = null; $('album-status').textContent = error.name === 'AbortError' ? '已取消选择，尚未写入文件夹，当前页面中的内容仍保留。' : `未完成保存：${error.message}。可以重试或下载资料包。`;
    } finally { busy = false; $('memory-save').disabled = $('memory-export').disabled = false; }
  }
  $('memory-save').addEventListener('click', saveFolder);
  $('memory-export').addEventListener('click', () => {
    if (!valid()) return;
    const blob = additionsZip(snapshot()), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = '我们的爱情之树-新增资料.zip'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    $('album-status').textContent = '资料包已生成。请将包内文件解压到本相册文件夹并合并同名文件夹，再重新打开 index.html；新增照片需重新打开后显示。';
  });
  $('memory-reload').addEventListener('click', () => location.reload());
  function showYear(year) {
    activeYear = year;
    const letter = saved.letters[year] || {};
    $('letter-year').textContent = year;
    const start = saved.settings.togetherDate, count = start ? year - Number(start.slice(0, 4)) + 1 : null;
    $('letter-chapter').textContent = count > 0 ? `我们的第 ${count} 圈年轮` : '这一年的我们';
    $('letter-title').value = letter.title ?? '这一年，想把故事写给你。';
    $('letter-body').value = letter.body || '';
    $('letter-signature').value = letter.signature ?? '一直喜欢你的我';
    $('letter-status').textContent = '写下一年的心动、小事与约定。内容会保存在本浏览器。';
    open($('year-letter'));
  }
  function saveLetter() {
    saved.letters[activeYear] = { title: $('letter-title').value, body: $('letter-body').value, signature: $('letter-signature').value };
    $('letter-status').textContent = persist() ? '已保存在本浏览器。也可通过“添加城市”保存到相册文件夹。' : '暂存于本次页面，请通过“添加城市”保存到相册文件夹。';
  }
  for (const id of ['letter-title', 'letter-body', 'letter-signature']) $(id).addEventListener('input', saveLetter);
  $('letter-save').addEventListener('click', saveLetter);
  $('letter-enter').addEventListener('click', () => $('year-letter').close());
  $('loading-skip').addEventListener('click', () => { $('loading').hidden = true; });
  const photo = catalog.photos[0]; if (photo) $('opening-photo').src = photo.src;
  return { showYear, loaded() { $('loading-progress').textContent = '回忆已就绪，欢迎回到我们的树下。'; $('loading').hidden = true; }, progress(done) { $('loading-progress').textContent = `正在收藏每一帧心动 · ${done} / ${catalog.photos.length}`; $('opening-progress').value = done / catalog.photos.length; } };
}

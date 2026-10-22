import { readEnvelopes, persistEnvelopes } from './envelope-store.js';
import { createEnvelopeReader } from './envelope-reader.js';

const $ = id => document.getElementById(id);
export function buildLoveEnvelopes({ syncRunning, onRecords, beforeOpen }) {
  window.travelTreeAdditions ||= { version: 1, records: [] };
  let records = readEnvelopes(window.travelTreeAdditions?.envelopes || []), reader = null;
  window.travelTreeAdditions.envelopes = records;
  let openingTimer = 0, revealTimer = 0, opening = false, currentRecord = null, editingId = null;
  const editor = $('envelope-editor'), dialog = $('envelope-reader'), form = $('envelope-form');
  function listLetters() {
    $('envelope-list-title').textContent = `树上的情书（${records.length} 封）`;
    $('envelope-list').replaceChildren(...records.map(record => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = `${record.title} · ${record.date}`;
      button.setAttribute('aria-haspopup', 'dialog'); button.addEventListener('click', () => { editor.close(); open(record); }); return button;
    }));
    $('envelope-list-empty').hidden = !!records.length;
  }
  function showEditor(record = null) {
    beforeOpen(); listLetters(); form.reset(); editingId = record?.id || null;
    for (const field of ['title', 'recipient', 'date', 'body', 'signature']) {
      const input = $('envelope-' + field); input.setCustomValidity('');
      if (record) input.value = record[field];
    }
    $('envelope-editor-heading').textContent = record ? '修改这封写给你的信。' : '把没说完的喜欢，写成一封信。';
    $('envelope-hang').textContent = record ? '保存修改' : '♡ 挂到树上';
    if (!$('envelope-date').value) {
      const today = new Date(); $('envelope-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    editor.showModal(); syncRunning();
  }
  $('add-envelope').addEventListener('click', () => showEditor());
  for (const id of ['envelope-title', 'envelope-body']) $(id).addEventListener('input', () => $(id).setCustomValidity(''));
  function hang(saveProject) {
    for (const id of ['envelope-title', 'envelope-body']) $(id).setCustomValidity($(id).value.trim() ? '' : '写下一点心意，再挂到树上吧。');
    if (!form.reportValidity()) return;
    const editing = !!editingId;
    const record = { id: editingId || crypto.randomUUID(), title: $('envelope-title').value.trim(), recipient: $('envelope-recipient').value.trim() || '亲爱的你', body: $('envelope-body').value, signature: $('envelope-signature').value.trim() || '一直喜欢你的我', date: $('envelope-date').value };
    records = editing ? records.map(item => item.id === editingId ? record : item) : [...records, record];
    const saved = persistEnvelopes(records);
    window.travelTreeAdditions.envelopes = records;
    onRecords(records); form.reset(); editingId = null; editor.close();
    $('envelope-save-status').textContent = saved ? (editing ? '情书修改已保存到当前浏览器。' : '情书已挂到树上，并保存在当前浏览器。') : '情书已更新；浏览器未能保存，请保存到项目文件夹。';
    if (saveProject || !saved) { $('add-city').click(); $('memory-save').click(); }
  }
  form.addEventListener('submit', event => { event.preventDefault(); hang(false); });
  $('envelope-save-project').addEventListener('click', () => hang(true));
  function revealText() {
    clearTimeout(openingTimer); clearTimeout(revealTimer);
    reader?.dispose(); reader = null;
    $('envelope-stage-wrap').hidden = true; $('envelope-page').hidden = false;
    dialog.classList.remove('is-revealing');
    dialog.classList.add('is-read'); $('envelope-page').focus({ preventScroll: true });
  }
  function showText(animate = false) {
    clearTimeout(openingTimer); clearTimeout(revealTimer);
    if (!animate) { revealText(); return; }
    dialog.classList.add('is-revealing'); revealTimer = setTimeout(revealText, 550);
  }
  function open(record) {
    beforeOpen(); currentRecord = record;
    clearTimeout(openingTimer); clearTimeout(revealTimer); reader?.dispose(); reader = null; opening = false;
    $('envelope-reader-heading').textContent = record.title;
    for (const field of ['recipient', 'body', 'signature', 'date']) $('envelope-read-' + field).textContent = record[field];
    $('envelope-stage-wrap').hidden = false; $('envelope-page').hidden = true;
    $('envelope-open-status').textContent = '有些心动，想亲手交给你。';
    dialog.classList.remove('is-read', 'is-revealing'); dialog.showModal(); dialog.querySelector('.envelope-scroll').scrollTop = 0; syncRunning();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) { showText(); return; }
    try {
      // A canvas that has released its WebGL context is replaced before the next letter.
      const canvas = $('envelope-stage'), fresh = canvas.cloneNode(); canvas.replaceWith(fresh);
      reader = createEnvelopeReader(fresh, { onRead: () => showText(true), onPhase(phase) {
        $('envelope-stage-wrap').dataset.phase = phase;
        $('envelope-open-status').textContent = { sealed: '有些心动，想亲手交给你。', seal: '玫瑰色的封印，藏着想对你说的话。', flap: '轻轻拆开，只属于你的心意。', rise: '把一字一句，慢慢交到你手里。', unfold: '那些没说完的喜欢，都在信里。', turn: '愿每一个明天，仍与你相伴。', settle: '写给你，也写给我们的往后。' }[phase];
      } });
      reader.open(record); fresh.addEventListener('click', unseal);
      openingTimer = setTimeout(unseal, 400);
    } catch { showText(); }
  }
  function unseal() {
    if (!reader || opening) return;
    clearTimeout(openingTimer); opening = true; reader.unseal();
  }
  $('envelope-skip').addEventListener('click', () => showText());
  $('envelope-edit').addEventListener('click', () => { dialog.close(); showEditor(currentRecord); });
  $('envelope-editor-close').addEventListener('click', () => editor.close());
  $('envelope-reader-close').addEventListener('click', () => dialog.close());
  editor.addEventListener('close', syncRunning);
  dialog.addEventListener('close', () => { clearTimeout(openingTimer); clearTimeout(revealTimer); reader?.dispose(); reader = null; syncRunning(); });
  return { open, get records() { return records; } };
}

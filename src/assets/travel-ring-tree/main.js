import { createTreeCatalog } from './data.js';
import { TravelRingTreeScene } from './scene.js';
import { yearRoute } from './year-route.js';
import { buildLoveAlbum } from './love-album.js';
import { readStory, writeStory } from './story-store.js';
import { buildLoveEnvelopes } from './love-envelopes.js';

const $ = id => document.getElementById(id);
const catalog = createTreeCatalog(window.travelRingTreeRecords || []);
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = motionPreference.matches;
const state = { year: null, city: null, photo: null, grouped: false, layout: 'carousel', rotating: false, rotationRequested: !reducedMotion, rotationSpeed: 1 };
let atmospherePreference = { night: false, effects: true };
try {
  const saved = JSON.parse(localStorage.getItem('love-tree:atmosphere:v1'));
  if (saved && typeof saved.night === 'boolean' && typeof saved.effects === 'boolean') atmospherePreference = saved;
} catch { /* Atmosphere preferences are optional. */ }
let album = null;
let envelopes = null;
let scene = null, hostActive = true, previousFocus = null, previousView = null;
let normalCitiesExpanded = false, routeExpanded = false;
let cityMemoryIndex = 0;
const storyDrafts = new Map();
const running = () => hostActive && !document.hidden && !document.querySelector('dialog[open]');
function syncRunning() { scene?.setRunning(running()); }
function syncRotation() {
  state.rotating = state.rotationRequested && !state.photo;
  $('heart-gather').textContent = state.layout === 'heart' ? '旋转木马' : '重聚爱心';
  $('heart-gather').setAttribute('aria-label', state.layout === 'heart' ? '切换为旋转木马模式' : '切换为立体爱心模式');
  $('rotation-toggle').textContent = state.rotating ? '暂停旋转' : '开始旋转';
  $('rotation-toggle').setAttribute('aria-pressed', String(state.rotating));
  $('rotation-toggle').disabled = !!state.photo;
  $('rotation-speed').textContent = `转速：${state.rotationSpeed}倍`;
  $('rotation-speed').setAttribute('aria-label', `当前旋转速度${state.rotationSpeed}倍，点击切换为${state.rotationSpeed % 3 + 1}倍`);
  scene?.setRotation(state.rotating, 1, state.rotationSpeed);
}
function syncAtmosphere(save = false) {
  const effects = atmospherePreference.effects && !motionPreference.matches;
  document.body.classList.toggle('night-mode', atmospherePreference.night);
  document.body.classList.toggle('effects-off', !effects);
  $('night-toggle').textContent = atmospherePreference.night ? '日间模式' : '夜晚模式';
  $('night-toggle').setAttribute('aria-pressed', String(atmospherePreference.night));
  $('effects-toggle').textContent = motionPreference.matches ? '系统已减弱动效' : effects ? '动态特效：已开启' : '动态特效：已关闭';
  $('effects-toggle').setAttribute('aria-pressed', String(effects));
  $('effects-toggle').disabled = motionPreference.matches;
  $('atmosphere-status').textContent = motionPreference.matches ? '系统减少动态效果：薄云、萤火虫、微风与呼吸光已停止' : !effects ? '已停止：薄云、萤火虫、叶片摆动、相框呼吸光' : atmospherePreference.night ? '弯月星光 · 萤火虫慢漂 · 相框轻呼吸' : '薄云慢漂 · 少量花瓣 · 柔和日光';
  $('effects-toggle').title = motionPreference.matches ? '系统已启用减少动态效果' : '控制薄云、花瓣、萤火虫、微风和呼吸光';
  scene?.setAtmosphere(atmospherePreference.night, effects);
  if (save) try { localStorage.setItem('love-tree:atmosphere:v1', JSON.stringify(atmospherePreference)); } catch { /* Keep the current session setting. */ }
}
function visiblePhotos() {
  return (state.city ? state.city.photos : []).filter(p => state.year === null || p.year === state.year);
}
function storyDraft(year, city) {
  const key = JSON.stringify([year ?? 'all', city.id]);
  if (!storyDrafts.has(key)) storyDrafts.set(key, { story: readStory(year, city.id), saved: true });
  return storyDrafts.get(key);
}
function syncCityPanel() {
  const route = state.year !== null;
  $('year-route').hidden = !route || !routeExpanded;
  $('city-nav').hidden = route || !normalCitiesExpanded;
  $('cities').classList.toggle('route-active', route && routeExpanded);
  $('cities').classList.toggle('story-active', !!state.city);
  const expanded = route ? routeExpanded : normalCitiesExpanded;
  $('city-toggle').textContent = route ? (expanded ? '收起路线' : '展开路线') : (expanded ? '收起城市' : '显示城市');
  $('city-toggle').setAttribute('aria-expanded', String(expanded));
  $('city-toggle').setAttribute('aria-controls', route ? 'year-route' : 'city-nav');
  scene?.setRouteInset(route && routeExpanded && innerWidth > 760 && !state.photo ? $('cities').getBoundingClientRect().right + 24 : 0);
}
function syncRouteSelection() {
  for (const button of $('route-list').querySelectorAll('[data-route-city]')) {
    const city = catalog.cities.find(city => city.id === button.dataset.routeCity);
    const story = storyDraft(state.year, city).story;
    button.setAttribute('aria-pressed', String(city === state.city));
    button.querySelector('.route-story').textContent = story.title.trim() || story.body.trim().split('\n')[0] || '写下这段故事';
  }
}
function renderYearRoute() {
  const route = yearRoute(catalog.cities, state.year);
  $('route-year').textContent = typeof state.year === 'number' ? String(state.year) : '年份未确定';
  $('route-summary').textContent = `${route.reduce((sum, stop) => sum + stop.visits, 0)} 次旅程 · ${route.length} 座城市 · 最近在前`;
  $('route-list').replaceChildren(...route.map(stop => {
    const item = document.createElement('li'), button = document.createElement('button');
    button.type = 'button'; button.className = 'route-stop'; button.dataset.routeCity = stop.city.id;
    const name = document.createElement('span'); name.className = 'route-name'; name.textContent = stop.city.title;
    const date = document.createElement('time'); date.className = 'route-date'; date.textContent = stop.dateLabel;
    if (stop.sortKey.length === 7) date.dateTime = stop.sortKey;
    const meta = document.createElement('span'); meta.className = 'route-meta';
    meta.textContent = `第${stop.arrival}次抵达 · ${stop.photoCount ? `${stop.photoCount} 张照片` : '本次暂无独立照片'}`;
    const preview = document.createElement('span'); preview.className = 'route-story';
    button.append(name, date, meta, preview); item.append(button);
    button.addEventListener('click', () => {
      selectCity(stop.city);
      $('city-story-toggle').scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });
    const storyButton = document.createElement('button');
    storyButton.type = 'button'; storyButton.className = 'route-open-story';
    storyButton.textContent = '展开城市故事';
    storyButton.setAttribute('aria-label', `展开${stop.city.title}的城市故事`);
    storyButton.setAttribute('aria-haspopup', 'dialog'); storyButton.setAttribute('aria-controls', 'city-memory');
    storyButton.addEventListener('click', () => {
      selectCity(stop.city);
      $('city-story-toggle').click();
      $('city-memory').querySelector('.city-memory-content').scrollTop = 0;
    });
    item.append(storyButton);
    return item;
  }));
  syncRouteSelection(); syncCityPanel();
}
function renderStoryEditor() {
  $('city-story').hidden = !state.city;
  if (!state.city) { syncCityPanel(); return; }
  const draft = storyDraft(state.year, state.city);
  $('story-heading').textContent = `${state.city.title}的故事`;
  $('story-context').textContent = `${state.year === null ? '全部年份' : state.year + ' 年'} · ${state.city.title}`;
  $('story-title').value = draft.story.title; $('story-body').value = draft.story.body;
  $('story-save-status').textContent = draft.saved ? '故事保存在当前浏览器' : '暂存于本次页面，浏览器未能保存';
  syncCityPanel();
}
function saveCurrentStory() {
  if (!state.city) return;
  const draft = storyDraft(state.year, state.city);
  draft.story = { title: $('story-title').value, body: $('story-body').value };
  draft.saved = writeStory(state.year, state.city.id, draft.story);
  $('story-save-status').textContent = draft.saved ? '已保存到当前浏览器' : '暂存于本次页面，浏览器未能保存';
  if ($('city-memory').open) renderCityMemory();
  syncRouteSelection();
}
function renderPhotos() {
  const photos = visiblePhotos();
  $('city-status').textContent = !state.city ? '请选择城市查看照片' : photos.length ? `${state.city.title}：${photos.length} 张照片` : '该城市在所选年份暂无照片，试试其他年份。';
  $('city-photos').replaceChildren(...photos.map(photo => {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', `查看${photo.title}照片`);
    const image = document.createElement('img'); image.src = photo.src; image.alt = photo.title; image.loading = 'lazy';
    image.addEventListener('error', () => { image.hidden = true; button.textContent = '查看'; }, { once: true });
    button.append(image); button.addEventListener('click', () => openPhoto(photo)); return button;
  }));
  for (const button of $('city-nav').querySelectorAll('[data-city]')) button.setAttribute('aria-pressed', String(button.dataset.city === state.city?.id));
  syncRouteSelection(); renderStoryEditor();
}
function renderCityMemory() {
  const city = state.photo?.story || state.city;
  if (!city) return;
  const story = storyDraft(state.year, city).story, photos = city.photos.filter(p => state.year === null || p.year === state.year);
  $('city-memory-heading').textContent = city.title;
  $('city-memory-context').textContent = state.year === null ? '属于我们的城市故事' : `${state.year} 年 · 属于我们的城市故事`;
  $('city-memory-title').textContent = story.title.trim() || '和你，一起走过这里。';
  $('city-memory-body').textContent = story.body.trim() || '这一站的故事还在等你写下。可以在左侧的故事编辑区，留下属于我们的心动。';
  cityMemoryIndex = photos.length ? (cityMemoryIndex + photos.length) % photos.length : 0;
  const photo = photos[cityMemoryIndex];
  $('city-memory-gallery').hidden = !photo; $('city-memory-empty').hidden = !!photo;
  if (!photo) { $('city-memory-image').removeAttribute('src'); $('city-memory-thumbs').replaceChildren(); return; }
  $('city-memory-image').src = photo.src; $('city-memory-image').alt = `${city.title} · ${photo.date || photo.year}`;
  $('city-memory-count').textContent = `${cityMemoryIndex + 1} / ${photos.length}`;
  $('city-memory-date').textContent = photo.date || String(photo.year);
  $('city-memory-prev').disabled = $('city-memory-next').disabled = photos.length < 2;
  $('city-memory-thumbs').replaceChildren(...photos.map((item, index) => {
    const button = document.createElement('button'), image = document.createElement('img');
    button.type = 'button'; button.setAttribute('aria-label', `查看第 ${index + 1} 张城市照片`); button.setAttribute('aria-pressed', String(index === cityMemoryIndex));
    image.src = item.src; image.alt = ''; image.loading = 'lazy'; button.append(image);
    button.addEventListener('click', () => { cityMemoryIndex = index; renderCityMemory(); }); return button;
  }));
}
function stepCityMemory(direction) { cityMemoryIndex += direction; renderCityMemory(); }
function selectYear(year) {
  closePhoto();
  state.year = year; state.city = null; routeExpanded = year !== null; syncRotation(); scene?.setFocusStory(null);
  syncCityPanel();
  if (scene) scene.flyToYear(year);
  for (const b of $('years').children) b.setAttribute('aria-pressed', String(b.dataset.year === (year === null ? 'all' : year === '年份未确定' ? 'unknown' : String(year))));
  renderCityNav(); renderYearRoute(); renderPhotos(); syncClusterUI(); $('cities').scrollTop = 0;
}
function selectCity(city) {
  closePhoto();
  if (scene?.yearTransition) scene.setYear(state.year);
  const cluster = scene?.cityClusters.find(c => c.city === city);
  if (cluster && scene.hiddenRings.has(cluster.ringIndex)) scene.setRingVisible(cluster.ringIndex, true);
  state.city = city;
  if (city) { if (state.year === null) normalCitiesExpanded = true; else routeExpanded = true; }
  scene?.setFocusStory(city); renderPhotos(); syncClusterUI();
  if (scene && city) scene.flyTo(scene.storyView(city), 1);
}
function syncClusterUI() {
  $('city-layout').textContent = state.grouped ? (state.layout === 'heart' ? '回到爱心' : '回到木马') : '按城市浏览';
  $('city-layout').setAttribute('aria-pressed', String(state.grouped));
  for (const button of $('city-nav').querySelectorAll('[data-ring-toggle]')) {
    const hidden = scene.hiddenRings.has(Number(button.dataset.ringToggle));
    button.textContent = hidden ? '显示本圈' : '隐藏本圈'; button.setAttribute('aria-pressed', String(hidden));
  }
}
function renderCityNav() {
  $('city-nav').replaceChildren();
  const addCity = (city, parent) => {
    if (state.year !== null && !city.photos.some(p => p.year === state.year)) return;
    const button = document.createElement('button'); button.type = 'button'; button.dataset.city = city.id; button.textContent = city.title;
    button.addEventListener('click', () => { selectYear(null); selectCity(city); });
    parent.append(button);
  };
  if (!state.grouped || !scene) { catalog.cities.forEach(city => addCity(city, $('city-nav'))); return; }
  const rings = [...new Set(scene.cityClusters.filter(c => state.year === null || c.city.photos.some(p => p.year === state.year)).map(c => c.ringIndex))].sort((a, b) => a - b);
  for (const index of rings) {
    const section = document.createElement('section'); section.dataset.ringSection = index;
    const heading = document.createElement('div'); heading.className = 'ring-heading';
    const title = document.createElement('span'); title.textContent = index === 0 ? '外圈' : index === 1 ? '内圈' : `内圈（${index}）`;
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.dataset.ringToggle = index;
    toggle.addEventListener('click', () => {
      const visible = scene.hiddenRings.has(index); scene.setRingVisible(index, visible);
      if (!visible && scene.cityClusters.some(c => c.ringIndex === index && c.city === state.city)) selectCity(null);
      syncClusterUI();
    });
    heading.append(title, toggle); section.append(heading);
    scene.cityClusters.filter(c => c.ringIndex === index).forEach(c => addCity(c.city, section));
    $('city-nav').append(section);
  }
  syncClusterUI();
}
function syncPhotoInset() {
  const panel = $('photo-dialog'), width = panel.offsetWidth;
  const fullscreen = width >= innerWidth - 1;
  panel.setAttribute('aria-modal', String(fullscreen));
  scene?.setInset(fullscreen ? 0 : width, 0); scene?._applyInset(1);
  syncCityPanel();
}
function openPhoto(photo) {
  const opening = !state.photo;
  if (opening) { previousFocus = document.activeElement; previousView = scene ? { pos: scene.camera.position.clone(), target: scene.controls.target.clone() } : null; }
  if (scene?.yearTransition) scene.setYear(state.year);
  state.photo = photo; syncRotation(); scene?.setSelected(photo); syncRunning();
  $('photo-title').textContent = photo.title;
  $('photo-date').textContent = photo.date || String(photo.year);
  $('photo-error').hidden = true; $('original-photo').hidden = false;
  // 独立版的内嵌图像与原图字节相同，移动文件夹或缺少原文件时仍可完整查看。
  $('original-photo').alt = photo.title; $('original-photo').src = photo.src.startsWith('data:image/') ? photo.src : photo.full || photo.src;
  $('photo-dialog').hidden = false; document.body.classList.add('photo-open');
  $('city-story').inert = true;
  if (opening) parent.postMessage({ type: 'tree:photo-panel', open: true }, '*');
  if (opening) $('photo-close').focus();
  const list = photoList(); $('photo-prev').disabled = $('photo-next').disabled = list.length < 2;
  $('photo-city').textContent = photo.story.title; $('photo-count').textContent = `${list.indexOf(photo) + 1} / ${list.length}`;
  $('photo-strip').replaceChildren(...list.map(p => {
    const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', `查看${p.title}第${list.indexOf(p) + 1}张照片`); button.setAttribute('aria-pressed', String(p === photo));
    const img = document.createElement('img'); img.src = p.src; img.alt = p.title; img.loading = 'lazy'; button.append(img); button.addEventListener('click', () => openPhoto(p)); return button;
  }));
  syncPhotoInset();
  if (scene) scene.flyTo(scene.photoView(photo), 1);
}
function photoList() {
  const list = state.photo?.story.photos || [];
  return list.filter(p => state.year === null || p.year === state.year);
}
function closePhoto() {
  if (!state.photo) return;
  state.photo = null; scene?.setSelected(null); $('photo-dialog').hidden = true; document.body.classList.remove('photo-open');
  $('city-story').inert = false;
  parent.postMessage({ type: 'tree:photo-panel', open: false }, '*');
  scene?.setInset(0, 0);
  syncRotation();
  syncCityPanel();
  if (scene && previousView) scene.flyTo(previousView, 1);
  previousView = null; $('photo-strip').replaceChildren();
  $('original-photo').removeAttribute('src'); syncRunning(); previousFocus?.focus();
}
function stepPhoto(dir) {
  const list = photoList(), index = list.indexOf(state.photo);
  if (list.length) openPhoto(list[(index + dir + list.length) % list.length]);
}
function buildUI() {
  $('night-toggle').addEventListener('click', () => { atmospherePreference.night = !atmospherePreference.night; syncAtmosphere(true); });
  $('effects-toggle').addEventListener('click', () => { atmospherePreference.effects = !atmospherePreference.effects; syncAtmosphere(true); });
  motionPreference.addEventListener('change', e => { if (scene) scene.reducedMotion = e.matches; syncAtmosphere(); });
  syncAtmosphere();
  $('city-toggle').addEventListener('click', () => {
    if (state.year === null) normalCitiesExpanded = !normalCitiesExpanded; else routeExpanded = !routeExpanded;
    syncCityPanel();
  });
  for (const id of ['city-story-toggle', 'photo-city-story']) $(id).addEventListener('click', () => {
    cityMemoryIndex = 0; renderCityMemory(); $('city-memory').showModal(); syncRunning();
  });
  $('city-memory-close').addEventListener('click', () => $('city-memory').close());
  $('city-memory').addEventListener('close', syncRunning);
  $('city-memory-prev').addEventListener('click', () => stepCityMemory(-1));
  $('city-memory-next').addEventListener('click', () => stepCityMemory(1));
  $('city-memory').addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); stepCityMemory(e.key === 'ArrowLeft' ? -1 : 1); }
  });
  let swipeStart = null;
  $('city-memory-image').addEventListener('pointerdown', e => { swipeStart = { x: e.clientX, y: e.clientY }; });
  $('city-memory-image').addEventListener('pointerup', e => {
    if (swipeStart && Math.abs(e.clientX - swipeStart.x) > 45 && Math.abs(e.clientX - swipeStart.x) > Math.abs(e.clientY - swipeStart.y)) stepCityMemory(e.clientX < swipeStart.x ? 1 : -1);
    swipeStart = null;
  });
  $('city-memory-image').addEventListener('pointercancel', () => { swipeStart = null; });
  $('story-title').addEventListener('input', saveCurrentStory);
  $('story-body').addEventListener('input', saveCurrentStory);
  $('story-save').addEventListener('click', saveCurrentStory);
  $('summary').textContent = window.travelTreeAdditions?.demo === true ? `在线演示 · ${catalog.photos.length} 张示例画面 · 不含私人资料` : `${catalog.photos.length} 个瞬间 · ${catalog.cities.length} 座城市的回忆`;
  const years = [null, ...catalog.years];
  if (catalog.photos.some(p => p.year === '年份未确定')) years.push('年份未确定');
  for (const year of years) {
    const button = document.createElement('button'); button.type = 'button';
    button.dataset.year = year === null ? 'all' : year === '年份未确定' ? 'unknown' : String(year);
    button.textContent = year === null ? '全部' : String(year);
    button.addEventListener('click', () => { selectYear(year); if (Number.isInteger(year)) album.showYear(year); }); $('years').append(button);
  }
  renderCityNav();
  selectYear(null);
  $('whole-view').addEventListener('click', () => { closePhoto(); selectCity(null); if (scene) scene.flyTo(scene.wholeView(.35), 1); });
  $('heart-gather').addEventListener('click', () => {
    if (!scene) return;
    const mode = state.layout === 'carousel' ? 'heart' : 'carousel';
    closePhoto(); state.grouped = false; scene.setClusterMode(false); selectYear(null); renderCityNav();
    state.layout = mode; state.rotationRequested = mode === 'carousel' && !reducedMotion;
    scene.setLayoutMode(mode, !reducedMotion);
    syncRotation();
    scene.flyTo(scene.wholeView(), reducedMotion ? 0 : 1);
  });
  $('rotation-toggle').addEventListener('click', () => {
    if (!scene) return;
    state.rotationRequested = !state.rotationRequested; syncRotation();
  });
  $('rotation-speed').addEventListener('click', () => {
    state.rotationSpeed = state.rotationSpeed % 3 + 1; syncRotation();
  });
  $('city-layout').addEventListener('click', () => {
    if (!scene) return;
    closePhoto(); state.grouped = !state.grouped; scene.setClusterMode(state.grouped); renderCityNav(); selectCity(null);
    scene.flyTo(scene.wholeView(.35), 1);
  });
  $('photo-close').addEventListener('click', closePhoto);
  $('photo-prev').addEventListener('click', () => stepPhoto(-1)); $('photo-next').addEventListener('click', () => stepPhoto(1));
  $('original-photo').addEventListener('error', () => { $('original-photo').hidden = true; $('photo-error').hidden = false; });
  addEventListener('keydown', e => {
    if (document.querySelector('dialog[open]')) return;
    if (e.target instanceof HTMLElement && e.target.matches('input, textarea, [contenteditable="true"]')) return;
    if (state.photo && e.key === 'Tab' && $('photo-dialog').getAttribute('aria-modal') === 'true') {
      const panel = $('photo-dialog'), buttons = [...panel.querySelectorAll('button:not(:disabled)')];
      const first = buttons[0], last = buttons.at(-1);
      if (!panel.contains(document.activeElement) || document.activeElement === (e.shiftKey ? first : last)) {
        e.preventDefault(); (e.shiftKey ? last : first).focus();
      }
    }
    if (e.key === 'Escape') { e.preventDefault(); state.photo ? closePhoto() : parent.postMessage({ type: 'tree:close' }, '*'); }
    if (state.photo && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); stepPhoto(e.key === 'ArrowLeft' ? -1 : 1); }
    if (!state.photo && e.key === 'Tab' && parent !== window) {
      const buttons = [...document.querySelectorAll('button:not(:disabled)')].filter(b => b.getClientRects().length);
      if (document.activeElement === (e.shiftKey ? buttons[0] : buttons.at(-1))) {
        e.preventDefault(); parent.postMessage({ type: 'tree:focus-close' }, '*');
      }
    }
  });
}
function bindPointer() {
  const canvas = $('scene'); let down = null;
  canvas.addEventListener('pointerdown', e => {
    scene.cancelYearFocus();
    if (e.button !== 0) return;
    const rope = scene.pick(e.clientX, e.clientY)?.rope;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, rope };
    if (rope) { e.preventDefault(); e.stopImmediatePropagation(); scene.beginRopeDrag(rope, e.clientX, e.clientY); canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
  }, true);
  canvas.addEventListener('wheel', () => scene.cancelYearFocus(), { capture: true, passive: true });
  const releaseRope = () => { scene.endRopeDrag(); if (down && canvas.hasPointerCapture(down.id)) canvas.releasePointerCapture(down.id); down = null; canvas.style.cursor = ''; };
  canvas.addEventListener('pointercancel', releaseRope);
  canvas.addEventListener('lostpointercapture', releaseRope);
  window.addEventListener('blur', releaseRope);
  canvas.addEventListener('pointerup', e => {
    if (down?.rope) { e.preventDefault(); e.stopImmediatePropagation(); releaseRope(); return; }
    if (down?.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      const hit = scene.pick(e.clientX, e.clientY);
      if (hit?.envelope) envelopes.open(hit.envelope);
      else if (hit?.city) {
        selectCity(hit.city);
        $('city-story-toggle').click();
        $('city-memory').querySelector('.city-memory-content').scrollTop = 0;
      }
      else if (hit?.photo && (state.year === null || hit.photo.year === state.year)) openPhoto(hit.photo);
      else if (!hit && state.city) selectCity(null);
    }
    down = null;
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (down?.rope) { e.preventDefault(); e.stopImmediatePropagation(); scene.moveRopeDrag(e.clientX, e.clientY); return; }
    if (!down) { const hit = scene.pick(e.clientX, e.clientY); canvas.style.cursor = hit?.rope ? 'grab' : hit?.city || hit?.envelope ? 'pointer' : ''; scene.hoveredCity = hit?.city || hit?.photo?.story || null; scene.setHovered(hit?.photo || null); }
  }, true);
  canvas.addEventListener('pointerleave', () => { if (!down?.rope) canvas.style.cursor = ''; scene.hoveredCity = null; scene.setHovered(null); });
}
function loadTexture(photo) {
  return new Promise(resolve => {
    const image = new Image(); let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
    const timer = setTimeout(finish, 15000);
    image.onload = () => {
      if (done) return;
      try {
        const ratio = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        scene.setPhotoTexture(photo, canvas);
      } catch { /* The original remains available in the city viewer. */ }
      finish();
    };
    image.onerror = finish; image.src = photo.src;
  });
}
async function init() {
  album = buildLoveAlbum(catalog, syncRunning);
  envelopes = buildLoveEnvelopes({ syncRunning, beforeOpen: closePhoto, onRecords(records) { scene?.setEnvelopes(records); if (state.year !== null) selectYear(null); } });
  buildUI();
  if (!catalog.photos.length) {
    album.loaded(); $('fallback').textContent = '还没有照片，点击“添加城市”收藏第一段回忆。';
    $('fallback').hidden = false; document.body.classList.add('fallback'); return;
  }
  try { scene = new TravelRingTreeScene($('scene'), { reducedMotion }); }
  catch { $('loading').hidden = true; $('fallback').hidden = false; document.body.classList.add('fallback'); return; }
  scene.buildRoom(); scene.setPhotos(catalog.photos, catalog.cities, catalog.years); scene.setEnvelopes(envelopes.records); syncAtmosphere(); bindPointer();
  const view = scene.wholeView(.35);
  scene.camera.position.copy(view.pos); scene.controls.target.copy(view.target); scene.camera.lookAt(view.target);
  let loaded = 0;
  await Promise.all([scene.compile(), ...catalog.photos.map(photo => loadTexture(photo).then(() => album.progress(++loaded)))]);
  scene.settle(.5); syncRotation();
  scene.renderFirst(); album.loaded(); syncRunning();
  scene.on('contextrestored', () => { scene.resetPhotoTextures(); Promise.all(catalog.photos.map(loadTexture)).then(() => { scene.redraw(); syncRunning(); }); });
}
addEventListener('message', e => { if (e.source === parent && e.data?.type === 'platform:visibility') { hostActive = Boolean(e.data.active); syncRunning(); } });
document.addEventListener('visibilitychange', syncRunning);
// 在场景重新取景前更新可用宽度，手机全屏照片面板不占用三维画面的右侧留白。
addEventListener('resize', () => { if (state.photo) syncPhotoInset(); else syncCityPanel(); }, { capture: true });
addEventListener('pagehide', () => scene?.releaseContext());
addEventListener('pageshow', e => { if (e.persisted) scene?.restoreContext(); });
const ready = init().catch(error => { scene?.setRunning(false); $('loading').textContent = '回忆场景加载失败，仍可按城市查看照片。'; $('loading').style.inset = '120px 20px auto'; $('fallback').hidden = false; document.body.classList.add('fallback'); console.error('心动回忆', error); });
window.travelTree = { state, catalog, ready, get scene() { return scene; } };

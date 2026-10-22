function storyKey(year, cityId) {
  return 'love-tree:story:v1:' + encodeURIComponent(year ?? 'all') + ':' + encodeURIComponent(cityId);
}

export function readStory(year, cityId) {
  try {
    const value = JSON.parse(globalThis.localStorage.getItem(storyKey(year, cityId)));
    if (value && typeof value.title === 'string' && typeof value.body === 'string') return { title: value.title, body: value.body };
  } catch { /* Local files and privacy settings may block storage. */ }
  return { title: '', body: '' };
}

export function writeStory(year, cityId, story) {
  try {
    const { title, body } = story;
    if (typeof title !== 'string' || typeof body !== 'string') return false;
    globalThis.localStorage.setItem(storyKey(year, cityId), JSON.stringify({ title, body }));
    return true;
  } catch { return false; }
}

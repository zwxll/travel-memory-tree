const storageKey = 'love-tree:envelopes:v1';
const fields = ['id', 'title', 'recipient', 'body', 'signature', 'date'];

function validEnvelope(value) {
  if (!value || fields.some(field => typeof value[field] !== 'string') || !value.id.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return false;
  const date = new Date(value.date + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.date;
}
function envelopes(records) {
  return Array.isArray(records) ? records.filter(validEnvelope).map(({ id, title, recipient, body, signature, date }) => ({ id, title, recipient, body, signature, date })) : [];
}
export function readEnvelopes(imported = []) {
  let local = [];
  try { local = JSON.parse(globalThis.localStorage.getItem(storageKey)); }
  catch { /* Imported letters remain available when browser storage is blocked. */ }
  return [...new Map([...envelopes(imported), ...envelopes(local)].map(record => [record.id, record])).values()];
}
export function persistEnvelopes(records) {
  try {
    if (!Array.isArray(records) || records.some(record => !validEnvelope(record))) return false;
    globalThis.localStorage.setItem(storageKey, JSON.stringify(envelopes(records)));
    return true;
  } catch { return false; }
}

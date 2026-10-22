const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/assets/travel-ring-tree/year-route.js'), 'utf8');
  const { yearRoute } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const shared = { year: 2024, visitYears: [2023, 2024, 2026, 2026], visitMonths: ['2023-10', '2024-02', '2026-06', '2026-08', '2026-06', '2026-00', '2026-13', '2026-8', '2026-08-01', null] };
  const fixtures = [
    { id: 'multi', title: '多次旅行', photos: [shared, { ...shared }] },
    { id: 'unknown', title: '仅记录年份', photos: [{ year: 2026, visitYears: [2021, 2026, 2026], visitMonths: [] }] },
    { id: 'same', title: '同月城市', photos: [{ year: 2026, visitYears: [], visitMonths: ['2026-08'] }] },
    { id: 'archive', title: '只有归档年份', photos: [{ year: 2026 }] },
  ];
  const before = JSON.stringify(fixtures);
  const route = yearRoute(fixtures, 2026);
  assert.deepEqual(route.map(r => r.city.id), ['multi', 'same', 'unknown', 'archive'], 'equal months keep input order and unknown months sort last');
  assert.deepEqual(route.map(({ city, ...rest }) => rest), [
    { dateLabel: '2026-08 · 2026-06', sortKey: '2026-08', visits: 2, arrival: 4, photoCount: 0 },
    { dateLabel: '2026-08', sortKey: '2026-08', visits: 1, arrival: 1, photoCount: 1 },
    { dateLabel: '月份未记录', sortKey: '2026', visits: 1, arrival: 2, photoCount: 1 },
    { dateLabel: '月份未记录', sortKey: '2026', visits: 1, arrival: 1, photoCount: 1 },
  ]);
  const archive2024 = yearRoute(fixtures, 2024)[0];
  assert.equal(archive2024.photoCount, 2); assert.equal(archive2024.arrival, 2);
  assert.strictEqual(route[0].city, fixtures[0], 'retain the original city object for selection');
  assert.equal(JSON.stringify(fixtures), before, 'route calculation must not mutate records');
  assert.deepEqual(yearRoute(fixtures, null), []);
  assert.deepEqual(yearRoute([], 2026), []);
  assert.deepEqual(yearRoute(fixtures, 2030), []);
  console.log('PASS: synthetic routes, revisits, archive counts, stable month order, unique arrivals, missing/invalid months, empty years and unchanged records');
})().catch(error => { console.error(error); process.exitCode = 1; });

// Visits are city history; photo.year remains the independent archive year.
export function yearRoute(cities, year) {
  if (!Number.isInteger(year)) return [];
  const route = [];
  for (const city of cities) {
    const years = new Set(), monthsByYear = new Map();
    let photoCount = 0;
    for (const photo of city.photos) {
      if (photo.year === year) photoCount++;
      if (Number.isInteger(photo.year)) years.add(photo.year);
      for (const visitYear of Array.isArray(photo.visitYears) ? photo.visitYears : []) if (Number.isInteger(visitYear)) years.add(visitYear);
      for (const month of Array.isArray(photo.visitMonths) ? photo.visitMonths : []) {
        if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) continue;
        const visitYear = Number(month.slice(0, 4)); years.add(visitYear);
        if (!monthsByYear.has(visitYear)) monthsByYear.set(visitYear, new Set());
        monthsByYear.get(visitYear).add(month);
      }
    }
    if (!years.has(year)) continue;
    const months = [...(monthsByYear.get(year) || [])].sort().reverse();
    const arrival = [...years].reduce((total, visitYear) => total + (visitYear <= year ? monthsByYear.get(visitYear)?.size || 1 : 0), 0);
    route.push({
      city,
      dateLabel: months.length ? months.join(' · ') : '月份未记录',
      sortKey: months[0] || String(year),
      visits: months.length || 1,
      arrival,
      photoCount,
    });
  }
  return route.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

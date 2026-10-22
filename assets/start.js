(async function () {
  const additions = window.travelTreeAdditions || { version: 1, records: [], settings: {}, letters: {}, stories: {} };
  const records = window.travelRingTreeRecords ? [...window.travelRingTreeRecords, ...additions.records] : null;
  if (!records || typeof window.TravelRingTreeDocument !== 'function') {
    document.getElementById('status').textContent = '资料未能加载，请保留整个独立版文件夹后再打开 index.html。';
    return;
  }
  // 从离线数据读取真实图片比例；原图在独立版照片目录中打开。
  await Promise.all(records.map(record => new Promise(resolve => {
    record.full = new URL(record.localFile, location.href).href;
    const image = new Image();
    image.onload = () => { record.aspect = image.naturalWidth / image.naturalHeight; resolve(); };
    image.onerror = resolve;
    image.src = record.src;
  })));
  // 直接展示在本页，不使用原网站的地图外层和退出按钮。
  const html = window.TravelRingTreeDocument(records, additions);
  document.open(); document.write(html); document.close();
})();

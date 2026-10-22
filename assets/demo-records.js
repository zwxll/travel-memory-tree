// Public demo artwork, generated in the browser. No personal photos or trips.
(() => {
  const places = ['示例·海风', '示例·山野', '示例·花间', '示例·湖畔', '示例·晴空', '示例·暮色'];
  const palettes = [
    ['#d9e9e5', '#83aaa5', '#527b7a'], ['#e6dfcf', '#a8b496', '#6e806d'],
    ['#f1dce1', '#c79fae', '#8e6d81'], ['#dde4ed', '#a3b7ca', '#657d96'],
    ['#f4e4c9', '#d6b38e', '#a07e69'], ['#e4dce9', '#b5a2c5', '#7c6b94']
  ];
  window.travelRingTreeRecords = Array.from({ length: 72 }, (_, i) => {
    const city = i % places.length, colors = palettes[city], portrait = i % 4 === 0;
    const canvas = document.createElement('canvas'); canvas.width = portrait ? 480 : 640; canvas.height = portrait ? 640 : 480;
    const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    const sky = c.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, colors[0]); sky.addColorStop(1, '#fff8ee');
    c.fillStyle = sky; c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff6d9'; c.beginPath(); c.arc(w * (.3 + i % 3 * .2), h * .25, w * .09, 0, Math.PI * 2); c.fill();
    for (let layer = 0; layer < 3; layer++) {
      c.fillStyle = layer === 0 ? colors[1] : colors[2]; c.globalAlpha = .45 + layer * .18;
      c.beginPath(); c.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) c.lineTo(x, h * (.5 + layer * .13) + Math.sin(x / w * 6 + i * .4 + layer) * h * .07);
      c.lineTo(w, h); c.closePath(); c.fill();
    }
    c.globalAlpha = 1; c.fillStyle = '#ffffffdd'; c.fillRect(24, h - 102, w - 48, 78);
    c.fillStyle = colors[2]; c.font = '22px serif'; c.textAlign = 'center'; c.fillText(places[city], w / 2, h - 65);
    c.font = '13px sans-serif'; c.fillText('GENERATED DEMO · ' + String(i + 1).padStart(2, '0'), w / 2, h - 42);
    const year = 2024 + Math.floor(i / 24), month = String(Math.floor(i / 6) % 12 + 1).padStart(2, '0');
    return { id: 'demo:' + (i + 1), cityKey: 'demo-city-' + city, title: places[city], year, date: year + '-' + month + '-01', dateSource: 'demo', visitYears: [year], visitMonths: [year + '-' + month], localFile: 'demo/card-' + (i + 1) + '.png', src: canvas.toDataURL('image/png'), aspect: w / h };
  });
})();

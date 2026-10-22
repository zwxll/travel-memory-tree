// Synthetic records only: no real destinations, dates, photos or user data.
module.exports = Array.from({ length: 164 }, (_, i) => ({
  id: 'sample-' + i,
  cityKey: 'sample-city-' + i % 27,
  title: '示例城市 ' + (i % 27 + 1),
  aspect: [3 / 4, 1, 4 / 3, 16 / 9][i % 4]
}));

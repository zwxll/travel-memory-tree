// The original tree's natural hanging positions, independent of the current mode.
export function carouselLayout(photos, cities, canopyHeight, heightScale) {
  if (!photos.length) return { positions: [], sectors: [], photoLift: 0 };
  const total = photos.length, gap = Math.min(.06, Math.PI / Math.max(1, cities.length));
  const usable = Math.PI * 2 - gap * cities.length;
  let angle = Math.PI / 2 - usable * cities[0].photos.length / total / 2;
  const positions = new Array(total), sectors = [], indices = new Map(photos.map((photo, i) => [photo, i]));
  cities.forEach((city, cityIndex) => {
    const sector = usable * city.photos.length / total;
    sectors.push({ a0: angle, a1: angle + sector, mid: angle + sector / 2 });
    city.photos.forEach((photo, i) => {
      const t = angle + sector * ((i * .61803398875 + .35) % 1), layer = (i + cityIndex) % 4;
      const r = 6 + 6.8 * ((i * .41421356237 + cityIndex * .17 + .25) % 1);
      positions[indices.get(photo)] = {
        x: Math.cos(t) * r,
        y: (4.7 + layer * 2.35 + ((i * .73 + cityIndex * .23) % 1) * 1.05) * heightScale,
        z: Math.sin(t) * r,
        anchorY: canopyHeight(r) * heightScale,
        phase: i,
      };
    });
    angle += sector + gap;
  });
  const photoLift = Math.max(0, Math.min(...positions.map((p, i) => p.anchorY - p.y - photos[i].h / 2 - .2))) / 2;
  return { positions: positions.map(p => ({ ...p, y: p.y + photoLift })), sectors, photoLift };
}

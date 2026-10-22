// Sample a solid implicit heart, then spread the original photos through its volume.
export function heartLayout(photos) {
  const count = photos.length;
  if (!count) return [];
  const halton = (index, base) => {
    let value = 0, fraction = 1;
    while (index) { fraction /= base; value += fraction * (index % base); index = Math.floor(index / base); }
    return value;
  };
  const candidates = [];
  for (let i = 1; candidates.length < Math.max(2400, count * 32); i++) {
    const x = (halton(i, 2) - .5) * 2.4, y = halton(i, 3) * 2.27 - 1.02, z = (halton(i, 5) - .5) * 1.6;
    const shell = x * x + 2.25 * z * z + y * y - 1;
    if (shell ** 3 - x * x * y ** 3 - .1125 * z * z * y ** 3 > 0) continue;
    // Deepen the upper cleft so the two lobes also read clearly from the front.
    const cleft = .45 * Math.exp(-((x / .5) ** 2)) * Math.max(0, y);
    const room = 1.13;
    candidates.push({ x: x * 11.7 * room, y: 11.6 + (y - cleft) * 10.3 * room, z: z * 8.4 * room });
  }
  const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
  const nearest = candidates.map(() => Infinity), slots = [];
  let next = candidates.reduce((best, p, i) => distanceSquared(p, { x: 0, y: 12, z: 0 }) < distanceSquared(candidates[best], { x: 0, y: 12, z: 0 }) ? i : best, 0);
  for (let i = 0; i < count; i++) {
    const point = candidates[next]; slots.push(point);
    let farthest = -1;
    candidates.forEach((candidate, j) => {
      nearest[j] = Math.min(nearest[j], distanceSquared(point, candidate));
      if (nearest[j] > farthest) { farthest = nearest[j]; next = j; }
    });
  }
  // Nearby heights keep city runs together without collapsing the depth distribution.
  slots.sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z);
  return photos.map((photo, i) => {
    const aspect = Number.isFinite(photo.aspect) && photo.aspect > 0 ? photo.aspect : .75;
    let w = Math.min(1.68, 1.41 / aspect), h = w * aspect;
    const spacing = Math.sqrt(Math.min(...slots.filter((_, j) => j !== i).map(p => distanceSquared(slots[i], p))));
    const scale = Math.min(1, Math.max(.05, (spacing * .94 - .325) / Math.hypot(w, h)));
    w *= scale; h *= scale;
    return { ...slots[i], w, h };
  });
}

import * as THREE from 'three';

export function frameKeepsakeMaterial() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#e7a7b7';
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3;
    c.beginPath(); c.ellipse(64 + Math.cos(angle) * 27, 64 + Math.sin(angle) * 27, 25, 17, angle, 0, Math.PI * 2); c.fill();
  }
  c.fillStyle = '#e2b972'; c.beginPath(); c.arc(64, 64, 16, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#fff0d2'; c.beginPath(); c.arc(60, 60, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#c77f94';
  c.beginPath(); c.moveTo(192, 99); c.bezierCurveTo(184, 91, 158, 73, 158, 51);
  c.bezierCurveTo(158, 29, 183, 26, 192, 46); c.bezierCurveTo(201, 26, 226, 29, 226, 51);
  c.bezierCurveTo(226, 73, 200, 91, 192, 99); c.fill();
  c.fillStyle = '#d5b382';
  for (const x of [141, 243]) { c.beginPath(); c.arc(x, 65, 3, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = '#9fa885'; c.lineWidth = 3;
  for (const [x, y] of [[42, 198], [79, 163], [104, 207]]) {
    c.beginPath(); c.moveTo(12, 240); c.quadraticCurveTo(x - 15, 220, x, y); c.stroke();
  }
  c.fillStyle = '#b7c29d';
  for (const [x, y, angle] of [[27, 219, -.6], [46, 217, .3], [56, 188, -.7], [78, 224, .6], [95, 230, -.3]]) {
    c.save(); c.translate(x, y); c.scale(1 / 3, 1);
    c.beginPath(); c.ellipse(0, 0, 17, 7, angle, 0, Math.PI * 2); c.fill(); c.restore();
  }
  for (const [x, y, radius, color] of [[42, 198, 23, '#e8acb9'], [79, 163, 25, '#f6d7c4'], [104, 207, 22, '#eebecb']]) {
    c.save(); c.translate(x, y); c.scale(1 / 3, 1);
    c.fillStyle = color;
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3;
      c.beginPath(); c.ellipse(Math.cos(angle) * radius * .62, Math.sin(angle) * radius * .62, radius * .58, radius * .35, angle, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#d4aa69'; c.beginPath(); c.arc(0, 0, radius * .28, 0, Math.PI * 2); c.fill(); c.restore();
  }
  c.strokeStyle = '#d6b68c'; c.lineWidth = 1.5; c.setLineDash([3, 5]);
  c.beginPath(); c.moveTo(139, 231); c.bezierCurveTo(161, 245, 183, 150, 241, 218); c.stroke(); c.setLineDash([]);
  for (const [x, y, size, color] of [[157, 216, 19, '#e5a4b6'], [193, 177, 24, '#c9839b'], [232, 208, 20, '#edc0b8']]) {
    c.save(); c.translate(x, y); c.scale(size / 34 / (.45 / .13), size / 34); c.fillStyle = color;
    c.beginPath(); c.moveTo(0, 30); c.bezierCurveTo(-8, 22, -34, 4, -34, -18);
    c.bezierCurveTo(-34, -40, -9, -43, 0, -23); c.bezierCurveTo(9, -43, 34, -40, 34, -18);
    c.bezierCurveTo(34, 4, 8, 22, 0, 30); c.fill(); c.restore();
  }
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: .15, side: THREE.DoubleSide, toneMapped: false, fog: false });
}

export function frameKeepsakes(photo, scale, material) {
  const positions = [], uvs = [], indices = [];
  // One shared atlas and one mesh per card keep these small details inexpensive.
  const quad = (x, y, w, h, angle, u0, v0, u1, v1) => {
    for (const z of [-.06, .06]) {
      const start = positions.length / 3, cos = Math.cos(angle), sin = Math.sin(angle);
      for (const [dx, dy] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
        positions.push(x + (dx * cos - dy * sin) * scale, y + (dx * sin + dy * cos) * scale, z * scale);
      }
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
      indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
    }
  };
  quad(-photo.w / 2 + .09 * scale, photo.h / 2 + .05 * scale, .10, .10, 0, 0, .5, .5, 1);
  quad(photo.w / 2 - .09 * scale, photo.h / 2 + .05 * scale, .13, .09, 0, .5, .5, 1, 1);
  quad(0, -photo.h / 2 - .105 * scale, .16, .12, 0, .5, .5, 1, 1);
  quad(-photo.w / 2 + .22 * scale, -photo.h / 2 - .09 * scale, .48, .16, 0, 0, 0, .5, .5);
  quad(photo.w / 2 - .21 * scale, -photo.h / 2 - .10 * scale, .45, .13, 0, .5, 0, 1, .5);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices);
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'photo-frame-keepsakes'; mesh.userData.photo = photo;
  return mesh;
}

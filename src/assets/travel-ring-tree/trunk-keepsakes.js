import * as THREE from 'three';
import { treeHeightScale } from './tree-model.js';

// City tags travel with their photos; only romantic ornaments stay on the trunk.
export function buildTrunkKeepsakes(cityClusters, tree) {
  const group = new THREE.Group(); group.name = 'tree-trunk-keepsakes';
  const signs = [], cords = [];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const bronze = new THREE.MeshStandardMaterial({ color: '#755737', roughness: .7, metalness: .25 });
  const glassGeometry = new THREE.CylinderGeometry(.105, .105, .34, 10);
  const glassMaterial = new THREE.MeshStandardMaterial({ color: '#fff0bc', emissive: '#ffd48a', emissiveIntensity: .85, roughness: .7 });
  const capGeometry = new THREE.CylinderGeometry(.14, .14, .035, 10);
  const handleGeometry = new THREE.TorusGeometry(.06, .012, 5, 12);
  const cordMaterial = new THREE.LineBasicMaterial({ color: '#b2956e', transparent: true, opacity: .88 });
  const glow = document.createElement('canvas'); glow.width = glow.height = 64;
  const glowContext = glow.getContext('2d'), halo = glowContext.createRadialGradient(32, 32, 0, 32, 32, 32);
  halo.addColorStop(0, '#ffe3a85c'); halo.addColorStop(.35, '#ffd58b24'); halo.addColorStop(1, '#ffd58b00');
  glowContext.fillStyle = halo; glowContext.fillRect(0, 0, 64, 64);
  const glowMap = new THREE.CanvasTexture(glow); glowMap.colorSpace = THREE.SRGBColorSpace;
  const glowMaterial = new THREE.SpriteMaterial({ map: glowMap, transparent: true, depthWrite: false });
  cityClusters.forEach(({ city, cards }, i) => {
    const card = cards[0];
    if (!card) return;
    const tag = new THREE.Group(); tag.name = `photo-city-keepsake-${city.id}`;
    tag.position.z = .08; card.group.add(tag);
    const height = Math.min(1, Math.max(.65, card.photo.h + .14));
    const x = (i % 2 ? -1 : 1) * (card.plate.geometry.parameters.width / 2 + height / 6 + .1);
    const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 576;
    const c = canvas.getContext('2d'), wood = c.createLinearGradient(0, 0, 192, 0);
    wood.addColorStop(0, '#cda774'); wood.addColorStop(.12, '#ebcda0'); wood.addColorStop(.85, '#e6c293'); wood.addColorStop(1, '#c29a67');
    c.fillStyle = wood; c.fillRect(0, 0, 192, 576);
    for (let grain = 0; grain < 20; grain++) {
      c.strokeStyle = grain % 3 ? '#a77c4620' : '#fff0c82b'; c.lineWidth = 1;
      c.beginPath();
      for (let py = 0; py <= 576; py += 12) {
        const px = grain * 10 + Math.sin(py * .015 + grain) * 2;
        py ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.stroke();
    }
    c.strokeStyle = '#ae8754'; c.lineWidth = 4; c.strokeRect(4, 4, 184, 568);
    c.strokeStyle = '#fff0c28c'; c.lineWidth = 2; c.strokeRect(11, 11, 170, 554);
    c.fillStyle = '#765b3b'; c.beginPath(); c.arc(96, 24, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#513d2e'; c.font = '64px KaiTi, STKaiti, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    Array.from(city.title).forEach((character, index) => c.fillText(character, 96, 112 + index * 80));
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true }));
    sign.name = `photo-city-sign-${city.id}`; sign.userData.city = city;
    sign.position.set(x, 0, 0); sign.scale.set(height / 3, height, 1);
    signs.push(sign); tag.add(sign);
    const lamp = new THREE.Group(); lamp.name = 'photo-city-lantern';
    lamp.position.set(x, height / 2 + .14, 0); lamp.scale.setScalar(.45);
    lamp.add(new THREE.Mesh(glassGeometry, glassMaterial));
    for (const y of [-.185, .185]) {
      const cap = new THREE.Mesh(capGeometry, bronze); cap.position.y = y; lamp.add(cap);
    }
    const handle = new THREE.Mesh(handleGeometry, bronze); handle.position.y = .26; lamp.add(handle);
    const light = new THREE.Sprite(glowMaterial); light.scale.set(.7, .85, 1); lamp.add(light); tag.add(lamp);
    const tether = [0, card.photo.h / 2 + .05, 0, x, height / 2 + .32, 0, x, height / 2 + .32, 0, x, height / 2 - .02, 0];
    tag.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tether, 3)), cordMaterial));
  });

  const satin = new THREE.MeshStandardMaterial({ color: '#d798ad', roughness: .56, metalness: .08, side: THREE.DoubleSide });
  // Follow the exact tapered, curved surface instead of floating helices.
  const stem = tree.getObjectByName('tree-main-trunk');
  const skin = stem.geometry.clone(); skin.scale(1, .8, 1);
  const cloth = stem.material.clone(); cloth.polygonOffset = false;
  const ribbon = new THREE.Mesh(skin, cloth); ribbon.name = 'trunk-love-ribbon'; group.add(ribbon);
  const vertices = stem.geometry.attributes.position, rings = [];
  for (let ring = 0; ring <= 64; ring++) {
    const center = new THREE.Vector3();
    for (let i = 0; i < 64; i++) center.add(v(vertices.getX(ring * 65 + i), vertices.getY(ring * 65 + i), vertices.getZ(ring * 65 + i)));
    center.divideScalar(64);
    let radius = 0;
    for (let i = 0; i < 64; i++) radius += Math.hypot(vertices.getX(ring * 65 + i) - center.x, vertices.getZ(ring * 65 + i) - center.z);
    rings.push({ center, radius: radius / 64 });
  }
  function wrappedPoint(y, angle, clearance) {
    const height = y / .8;
    let i = 0; while (i < rings.length - 2 && rings[i + 1].center.y < height) i++;
    const a = rings[i], b = rings[i + 1], t = THREE.MathUtils.clamp((height - a.center.y) / (b.center.y - a.center.y), 0, 1);
    const center = a.center.clone().lerp(b.center, t), radius = THREE.MathUtils.lerp(a.radius, b.radius, t) + clearance;
    return v(center.x + Math.sin(angle) * radius, y, center.z + Math.cos(angle) * radius);
  }

  // Two continuous strings wrap around every side; emissive beads need no extra scene lights.
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(.055, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe4c4', emissiveIntensity: 1.4, roughness: .3 }), 144);
  bulbs.name = 'trunk-love-lights';
  const bulbMatrix = new THREE.Matrix4(), bulbColor = new THREE.Color();
  for (let strand = 0; strand < 2; strand++) {
    const points = [];
    for (let i = 0; i <= 256; i++) {
      const t = i / 256, angle = t * Math.PI * 8 + strand * Math.PI + .35;
      points.push(wrappedPoint(1.8 + t * 20.2, angle, .045));
    }
    const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 256, .012, 5, false), bronze);
    wire.name = `trunk-love-light-wire-${strand}`; group.add(wire);
    for (let i = 0; i < 72; i++) {
      const t = i / 71, angle = t * Math.PI * 8 + strand * Math.PI + .35;
      const point = wrappedPoint(1.8 + t * 20.2, angle, .06);
      const index = strand * 72 + i;
      bulbs.setMatrixAt(index, bulbMatrix.makeTranslation(point.x, point.y, point.z));
      bulbs.setColorAt(index, bulbColor.set(['#fff0c2', '#ffc7d8', '#d6c7ff', '#cdf0df'][i % 4]));
      if (i % 3 === 0) {
        const light = new THREE.Sprite(glowMaterial); light.position.copy(point); light.scale.set(.28, .28, 1); group.add(light);
      }
    }
  }
  bulbs.computeBoundingBox(); bulbs.computeBoundingSphere(); group.add(bulbs);

  const heartShape = new THREE.Shape(); heartShape.moveTo(0, .22);
  heartShape.bezierCurveTo(-.35, .62, -.86, .44, -.78, -.02);
  heartShape.bezierCurveTo(-.72, -.4, -.28, -.68, 0, -.91);
  heartShape.bezierCurveTo(.28, -.68, .72, -.4, .78, -.02);
  heartShape.bezierCurveTo(.86, .44, .35, .62, 0, .22);
  const heartGeometry = new THREE.ExtrudeGeometry(heartShape, { depth: .13, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .055, bevelThickness: .045, curveSegments: 10 });
  heartGeometry.translate(0, .22, -.065);
  const hearts = new THREE.InstancedMesh(heartGeometry, new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .18, metalness: .16, clearcoat: .8, clearcoatRoughness: .16, emissive: '#ffe6ce', emissiveIntensity: .055 }), 12);
  hearts.name = 'trunk-love-hearts';
  const ornament = new THREE.Object3D(), color = new THREE.Color();
  for (let i = 0; i < hearts.count; i++) {
    const t = i / (hearts.count - 1), y = 2.5 + t * 18.3, angle = i * 2.39996;
    const { x, z } = wrappedPoint(y, angle, .075);
    ornament.position.set(x, y, z); ornament.rotation.set(0, angle, (i % 2 ? 1 : -1) * .14);
    ornament.scale.setScalar(.32 + i % 3 * .035); ornament.updateMatrix(); hearts.setMatrixAt(i, ornament.matrix);
    hearts.setColorAt(i, color.set(i % 2 ? '#efb7ca' : '#d66b92'));
    cords.push(...wrappedPoint(y + .7, angle, .015).toArray(), ...wrappedPoint(y + .2, angle, .075).toArray());

  }
  hearts.computeBoundingBox(); hearts.computeBoundingSphere(); group.add(hearts);

  const nightLamps = new THREE.Group(); nightLamps.name = 'trunk-night-lamps';
  const lampGlass = new THREE.MeshStandardMaterial({ color: '#fff0d1', emissive: '#ffd394', emissiveIntensity: .65, roughness: .45 });
  const lampGlow = glowMaterial.clone(); lampGlow.opacity = .4;
  const lampBrass = new THREE.MeshStandardMaterial({ color: '#c7a17a', metalness: .3, roughness: .55 });
  const lampBody = new THREE.SphereGeometry(.29, 14, 10), lampHandle = new THREE.TorusGeometry(.12, .018, 6, 16);
  nightLamps.userData.glassMaterial = lampGlass; nightLamps.userData.glowMaterial = lampGlow;
  for (let i = 0; i < 8; i++) {
    const t = i / 7, angle = i * 2.39996;
    const lamp = new THREE.Group(); lamp.name = `trunk-love-nightlight-${i}`;
    lamp.position.copy(wrappedPoint(2.6 + t * 17.5, angle, .44)); lamp.rotation.y = angle; lamp.scale.setScalar(.8);
    const glass = new THREE.Mesh(lampBody, lampGlass); glass.scale.y = 1.3; lamp.add(glass);
    for (const y of [-.37, .37]) {
      const cap = new THREE.Mesh(capGeometry, lampBrass); cap.scale.set(2.5, 2, 2.5); cap.position.y = y; lamp.add(cap);
    }
    const handle = new THREE.Mesh(lampHandle, lampBrass); handle.position.y = .51; lamp.add(handle);
    const bracket = new THREE.CatmullRomCurve3([v(0, .63, -.55), v(0, .77, -.25), v(0, .72, 0), v(0, .6, 0)]);
    lamp.add(new THREE.Mesh(new THREE.TubeGeometry(bracket, 12, .022, 5, false), lampBrass));
    const heart = new THREE.Mesh(heartGeometry, hearts.material); heart.scale.setScalar(.18); heart.position.set(0, -.025, .3); lamp.add(heart);
    const light = new THREE.Sprite(lampGlow); light.scale.set(1.8, 2.1, 1); lamp.add(light);
    nightLamps.add(lamp);
  }
  group.add(nightLamps);

  const cordGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(cords, 3));
  const tethers = new THREE.LineSegments(cordGeometry, new THREE.LineBasicMaterial({ color: '#b2956e', transparent: true, opacity: .88 }));
  tethers.name = 'trunk-love-tethers'; group.add(tethers);

  const bow = new THREE.Group(); bow.name = 'trunk-love-bow'; bow.position.copy(wrappedPoint(20.45, 0, .035)); bow.scale.setScalar(.7);
  for (const side of [-1, 1]) {
    const loop = new THREE.CatmullRomCurve3([v(0, 0, 0), v(side * .4, .35, .02), v(side * .82, .29, .07), v(side * .72, -.12, .09), v(side * .3, -.1, .03), v(0, 0, 0)]);
    bow.add(new THREE.Mesh(new THREE.TubeGeometry(loop, 28, .052, 6, false), satin));
    const tail = new THREE.CatmullRomCurve3([v(side * .06, -.03, 0), v(side * .19, -.4, .06), v(side * .32, -.85, .1)]);
    bow.add(new THREE.Mesh(new THREE.TubeGeometry(tail, 12, .055, 6, false), satin));
  }
  bow.add(new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), satin)); group.add(bow);
  group.scale.y = treeHeightScale / .8;
  return { group, signs };
}

import * as THREE from 'three';
import { canopyHeight } from './tree-model.js';
import { createEnvelopeModel, disposeEnvelopeObject } from './envelope-model.js';

function cupidHanger() {
  const group = new THREE.Group(); group.position.y = 2.45; group.name = 'envelope-cupid-hanger';
  const shape = new THREE.Shape(); shape.moveTo(0, -.75);
  shape.bezierCurveTo(-.1, -.6, -.85, -.05, -.85, .38); shape.bezierCurveTo(-.85, .95, -.25, 1.03, 0, .53);
  shape.bezierCurveTo(.25, 1.03, .85, .95, .85, .38); shape.bezierCurveTo(.85, -.05, .1, -.6, 0, -.75);
  const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .13, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 2, steps: 1, curveSegments: 12 }), new THREE.MeshStandardMaterial({ color: '#d796ac', roughness: .65, emissive: '#d796ac', emissiveIntensity: .4 }));
  heart.name = 'envelope-cupid-heart'; heart.position.z = .05; group.add(heart);
  const gold = new THREE.MeshStandardMaterial({ color: '#d0ac79', roughness: .72, emissive: '#d0ac79', emissiveIntensity: .3, side: THREE.DoubleSide });
  const arrow = new THREE.Group(); arrow.name = 'envelope-cupid-arrow'; arrow.rotation.z = .35; arrow.position.z = .035; group.add(arrow);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, 2.9, 6), gold); shaft.rotation.z = -Math.PI / 2; arrow.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(.16, .38, 8), gold); head.name = 'cupid-arrowhead'; head.rotation.z = -Math.PI / 2; head.position.x = 1.55; arrow.add(head);
  const tail = new THREE.Group(); tail.name = 'cupid-arrow-tail'; tail.position.x = -1.4; arrow.add(tail);
  for (const side of [-1, 1]) {
    const feather = new THREE.Shape(); feather.moveTo(-.36, side * .25); feather.lineTo(.02, side * .25); feather.lineTo(.35, 0); feather.lineTo(-.03, 0); feather.closePath();
    tail.add(new THREE.Mesh(new THREE.ShapeGeometry(feather), gold));
  }
  return group;
}

export function createHangingEnvelopes(owner) {
  const { tree } = owner;
  const group = new THREE.Group(); group.name = 'hanging-love-envelopes'; tree.add(group);
  const entries = [], pickables = [];
  const position = new THREE.Vector3(), local = new THREE.Vector3(), camera = new THREE.Vector3();
  let layoutKey = '';
  function placeAmongPhotos() {
    const photos = owner.cards.filter(card => (owner.year === null || card.photo.year === owner.year) && (!owner.clusterMode || card.group.parent.visible)).map(card => ({
      card, position: owner.clusterMode ? card.group.getWorldPosition(new THREE.Vector3()) : owner.cardGroup.localToWorld(card.photo.rest.clone()),
      w: card.photo.w * card.group.scale.x, h: card.photo.h * card.group.scale.y
    }));
    if (!photos.length) return;
    // Use the layout's overview so orbiting or opening a letter cannot reshuffle it.
    const view = owner.wholeView(), placementCamera = owner.camera.clone();
    placementCamera.clearViewOffset(); placementCamera.position.copy(view.pos); placementCamera.lookAt(view.target); placementCamera.updateMatrixWorld();
    const tan = Math.tan(THREE.MathUtils.degToRad(placementCamera.fov / 2));
    const screenRect = (point, w, h) => {
      const depth = -point.clone().applyMatrix4(placementCamera.matrixWorldInverse).z, p = point.clone().project(placementCamera);
      const x = w / (2 * depth * tan * placementCamera.aspect), y = h / (2 * depth * tan);
      return { minX: p.x - x, maxX: p.x + x, minY: p.y - y, maxY: p.y + y, depth };
    };
    const bounds = new THREE.Box3().setFromPoints(photos.map(photo => photo.position)).expandByScalar(.8);
    photos.forEach(photo => { photo.screen = screenRect(photo.position, photo.w + .16, photo.h + .22); });
    const right = new THREE.Vector3().setFromMatrixColumn(placementCamera.matrixWorld, 0), center = new THREE.Vector3();
    const placed = [];
    entries.forEach((entry, index) => {
      if (owner.year !== null && Number(entry.record.date.slice(0, 4)) !== owner.year) return;
      let best = null, bestScore = -Infinity;
      const consider = point => {
        point.clamp(bounds.min, bounds.max);
        if (owner.layoutMode !== 'heart' && Math.hypot(point.x, point.z) < 1.8) return;
        center.copy(point); center.y += .3;
        const rect = screenRect(center, 1.45, 1.85), body = point.clone().project(placementCamera), area = (rect.maxX - rect.minX) * (rect.maxY - rect.minY);
        let clearance = Infinity, cover = 0, blocked = 0;
        for (const photo of photos) {
          clearance = Math.min(clearance, center.distanceTo(photo.position) - Math.hypot(photo.w, photo.h) * .35);
          const r = photo.screen;
          cover += Math.max(0, Math.min(rect.maxX, r.maxX) - Math.max(rect.minX, r.minX)) * Math.max(0, Math.min(rect.maxY, r.maxY) - Math.max(rect.minY, r.minY)) / area;
          if (r.depth < rect.depth && body.x > r.minX && body.x < r.maxX && body.y > r.minY && body.y < r.maxY) blocked++;
        }
        for (const other of placed) clearance = Math.min(clearance, point.distanceTo(other) - 1.3);
        const score = clearance - cover * 2 - blocked * 4;
        if (score > bestScore) { bestScore = score; best = point.clone(); }
      };
      const samples = Math.min(32, photos.length);
      for (let i = 0; i < samples; i++) {
        const photo = photos[(Math.floor(i * photos.length / samples) + index * 7) % photos.length];
        const neighbors = photos.filter(other => other !== photo).sort((a, b) => a.position.distanceToSquared(photo.position) - b.position.distanceToSquared(photo.position)).slice(0, 3);
        for (const neighbor of neighbors) { position.copy(photo.position).lerp(neighbor.position, .5); position.y -= .3; consider(position); }
        for (const side of [-1, 1]) { position.copy(photo.position).addScaledVector(right, side * (photo.w / 2 + .85)); position.y -= .3; consider(position); }
      }
      if (!best) best = photos[index % photos.length].position.clone().addScaledVector(right, photos[index % photos.length].w / 2 + .9);
      const nearest = photos.reduce((a, b) => a.position.distanceToSquared(best) < b.position.distanceToSquared(best) ? a : b);
      entry.follow = nearest.card; entry.offset = best.clone().sub(nearest.position); placed.push(best);
    });
  }
  return { group, entries, pickables,
    setRecords(records) {
      disposeEnvelopeObject(group); group.clear(); entries.length = 0; pickables.length = 0; layoutKey = '';
      records.forEach(record => {
        const anchor = new THREE.Group(); group.add(anchor);
        const cord = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ba9997', transparent: true, opacity: .65 }));
        anchor.add(cord);
        const pivot = new THREE.Group(); pivot.scale.set(.37, .37 / tree.scale.y, .37); anchor.add(pivot);
        const model = createEnvelopeModel(); pivot.add(model.group);
        const labelCanvas = document.createElement('canvas'); labelCanvas.width = 384; labelCanvas.height = 80;
        const ctx = labelCanvas.getContext('2d'); ctx.fillStyle = '#f7ead5'; ctx.fillRect(0, 0, 384, 80);
        ctx.font = '26px SimSun, serif'; ctx.fillStyle = '#8e6270'; ctx.textAlign = 'center'; ctx.fillText(record.recipient || '写给你', 192, 50, 354);
        const map = new THREE.CanvasTexture(labelCanvas); map.colorSpace = THREE.SRGBColorSpace;
        const address = new THREE.Mesh(new THREE.PlaneGeometry(2.75, .5), new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide })); address.position.set(0, -.75, .08); model.group.add(address);
        pivot.add(cupidHanger());
        pivot.traverse(object => {
          if (object.isMesh) {
            if (object.material.isMeshStandardMaterial) object.material.emissiveIntensity = .55;
            object.userData.envelope = record; pickables.push(object);
          }
        });
        entries.push({ record, anchor, pivot, cord, world: null });
      });
      tree.updateWorldMatrix(true, true);
    },
    update(time, enabled, year, dt) {
      const key = `${owner.layoutMode}:${owner.clusterMode}:${year}:${[...owner.hiddenRings].join(',')}`;
      if (key !== layoutKey) { placeAmongPhotos(); layoutKey = key; }
      tree.updateWorldMatrix(true, false); camera.copy(owner.camera.position); tree.worldToLocal(camera);
      entries.forEach((entry, i) => {
        const { record, anchor, pivot, cord, follow, offset } = entry;
        anchor.visible = year === null || Number(record.date.slice(0, 4)) === year;
        if (follow) {
          follow.group.getWorldPosition(position).add(offset);
          if (!entry.world) entry.world = position.clone();
          else entry.world.lerp(position, owner.heartGather ? 1 - Math.exp(-dt * 8) : 1);
          local.copy(entry.world); tree.worldToLocal(local);
          anchor.position.set(local.x, canopyHeight(Math.hypot(local.x, local.z) / 1.15), local.z);
          anchor.rotation.y = Math.atan2(camera.x - local.x, camera.z - local.z);
          pivot.position.y = local.y - anchor.position.y;
          cord.geometry.attributes.position.setY(1, pivot.position.y + .425 / tree.scale.y); cord.geometry.attributes.position.needsUpdate = true; cord.geometry.computeBoundingSphere();
        }
        pivot.rotation.z = enabled ? Math.sin(time * .36 + i * .9) * .025 : 0;
        pivot.rotation.x = enabled ? Math.sin(time * .29 + i * 1.1) * .018 : 0;
      });
    }
  };
}

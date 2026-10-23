import * as THREE from 'three';
import { CanopyScene } from '../umbrella-canopy/js/scene.js';
import { buildTreeGarden } from './garden.js';
import { buildMemoryTree, canopyHeight, treeHeightScale } from './tree-model.js';
import { heartLayout } from './heart-layout.js';
import { carouselLayout } from './carousel-layout.js';
import { TreeAtmosphere } from './atmosphere.js';
import { buildTrunkKeepsakes } from './trunk-keepsakes.js';
import { addLoveDetails } from './love-details.js';
import { createHangingEnvelopes } from './hanging-envelopes.js';
import { frameKeepsakeMaterial, frameKeepsakes } from './photo-frame.js';

const carouselPhotoScale = 1.15;

// Camera controls, flights, texture uploads and lifecycle are read-only reuse.
export class TravelRingTreeScene extends CanopyScene {
  buildRoom() {
    this.scene.background = new THREE.Color('#faf3ef');
    this.scene.fog.color.set('#faf3ef'); this.scene.fog.density = .003;
    this._buildLights();
    this.garden = buildTreeGarden(this.scene, this.reducedMotion);
    this.garden.meadow.surface.material.color.set('#e8ddd1');
    this.scene.traverse(object => {
      const uniforms = object.material?.uniforms;
      if (uniforms?.topColor) {
        // 背景始终围绕相机，手机远景不会露出天空球的裁切边缘。
        object.frustumCulled = false;
        object.onBeforeRender = (renderer, _scene, camera) => {
          renderer.getDrawingBufferSize(uniforms.skyResolution.value);
          object.position.copy(camera.position); object.updateMatrixWorld(true);
          uniforms.sunDirection.value.copy(this.controls.target).sub(camera.position).normalize();
          uniforms.moonDirection.value.set(.7, .5, .5).unproject(camera).sub(camera.position).normalize();
          uniforms.moonRight.value.setFromMatrixColumn(camera.matrixWorld, 0);
          uniforms.moonUp.value.setFromMatrixColumn(camera.matrixWorld, 1);
        };
      }
    });
    this.common.uSway.value = 0;
    this.year = null;
    this._buildAtmosphere();
  }

  setRouteInset(left) { this.routeInset = left; this._applyInset(1); this.redraw(); }

  _viewport() {
    const view = super._viewport(), left = this.routeInset || 0;
    return { ...view, freeW: view.freeW - left, fullW: view.fullW + left };
  }

  _applyInset(dt) {
    super._applyInset(dt);
    if (this.routeInset > 0) this.camera.setViewOffset(this.width + this.inset.right + this.routeInset, this.height + this.inset.bottom, this.inset.right, this.inset.bottom, this.width, this.height);
  }

  _buildAtmosphere() { this.atmosphere = new TreeAtmosphere(this); }

  setAtmosphere(night, effects) { this.atmosphere.set(night, effects); }

  setPhotos(photos, cities, years) {
    this.photos = photos; this.stories = cities;
    this._layoutBranches();
    this.tree = buildMemoryTree(this.photos); this.scene.add(this.tree);
    this.cardGroup = new THREE.Group();
    this.scene.add(this.cardGroup);
    const clipGeometry = new THREE.BoxGeometry(.09 * this.heartScale, .18 * this.heartScale, .07 * this.heartScale);
    const clipMaterial = new THREE.MeshStandardMaterial({ color: '#b89169', roughness: .76 });
    const keepsakeMaterial = frameKeepsakeMaterial();
    this.cards = photos.map(photo => {
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ map: this.blankMap, color: 0xffffff, fog: false });
      const picture = new THREE.Mesh(this._cardGeometry(photo.w, photo.h), mat);
      // Keep both photo faces clear of the backing plate at distant camera views.
      const vertices = picture.geometry.attributes.position;
      for (let i = 0; i < vertices.count; i++) vertices.setZ(i, Math.sign(vertices.getZ(i)) * .05 * this.heartScale);
      vertices.needsUpdate = true;
      // Warm emission supplies the paper color; the darker diffuse layer adds slight shading.
      const plate = new THREE.Mesh(new THREE.BoxGeometry(photo.w + .18 * this.heartScale, photo.h + .27 * this.heartScale, .035 * this.heartScale), new THREE.MeshLambertMaterial({ color: '#4a3c2e', toneMapped: false, fog: false }));
      plate.position.y = -.035 * this.heartScale;
      picture.userData.photo = plate.userData.photo = photo;
      const clip = new THREE.Mesh(clipGeometry, clipMaterial);
      clip.position.set(0, photo.h / 2 + .075 * this.heartScale, .055 * this.heartScale); clip.userData.photo = photo;
      group.add(plate, picture, clip, frameKeepsakes(photo, this.heartScale, keepsakeMaterial)); group.position.copy(photo.rest); this.cardGroup.add(group);
      return { photo, group, mat, plate, clip, dim: 0, loaded: false, yaw: 0 };
    });
    this.photoThreads = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(photos.length * 12), 3)), new THREE.LineBasicMaterial({ color: '#a78b79', transparent: true, opacity: .24, depthWrite: false }));
    this.photoThreads.name = 'travel-photo-threads'; this.scene.add(this.photoThreads);
    this.threadCount = photos.length;
    this._threadEnd = new THREE.Vector3(); this._threadNeck = new THREE.Vector3(); this._threadAnchor = new THREE.Vector3();
    this.plateHits = this.cards.flatMap(card => [...card.group.children]);
    this._pickables = this.plateHits;
    this.clusterMode = false; this._clusterPoint = new THREE.Vector3();
    this.hiddenRings = new Set(); this.yearTransition = null;
    this.rotationActive = false; this.rotationDirection = 1; this.rotationSpeed = 1; this.hangingTime = 0; this.hangingAmplitude = 0;
    this.cityClusters = cities.map(city => {
      const group = new THREE.Group(); group.name = `city-cluster-${city.id}`; group.visible = false;
      const label = this._citySign(city);
      label.position.y = 3; group.add(label);
      const strings = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#bca1a9', transparent: true, opacity: .45 }));
      const tails = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#bca1a9', transparent: true, opacity: .7 }));
      group.add(strings, tails); this.cardGroup.add(group);
      const cluster = { city, group, label, strings, tails, ropes: [], cards: this.cards.filter(card => card.photo.story === city) };
      tails.userData.rope = cluster; return cluster;
    });
    const keepsakes = buildTrunkKeepsakes(this.cityClusters, this.tree);
    this.trunkKeepsakes = keepsakes.group; this.trunkSigns = keepsakes.signs;
    this.scene.add(this.trunkKeepsakes); this._pickables.push(...this.trunkSigns);
    this.threadHearts = new THREE.InstancedMesh(this.trunkKeepsakes.getObjectByName('trunk-love-hearts').geometry, new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .18, metalness: .16, clearcoat: .8, clearcoatRoughness: .16, emissive: '#ffe6ce', emissiveIntensity: .055 }), photos.length);
    this.threadHearts.name = 'photo-thread-love-hearts';
    this.threadHearts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const heartColor = new THREE.Color();
    for (let i = 0; i < photos.length; i++) this.threadHearts.setColorAt(i, heartColor.set(i % 3 ? '#e6a0b6' : '#f2d7aa'));
    this._threadOrnament = new THREE.Object3D(); this.scene.add(this.threadHearts);
    const crownHearts = new THREE.InstancedMesh(this.threadHearts.geometry, this.threadHearts.material, 25);
    crownHearts.name = 'tree-crown-love-hearts';
    const crownHeart = new THREE.Object3D();
    for (let i = 0; i < crownHearts.count; i++) {
      const angle = i * 2.39996, radius = i ? Math.sqrt(i / 24) * 14 : 0;
      crownHeart.position.set(Math.cos(angle) * radius * 1.15, canopyHeight(radius) + 3.5, Math.sin(angle) * radius * 1.15);
      crownHeart.rotation.set(-Math.PI / 2 + .18 * Math.sin(angle), .12 * Math.cos(angle), angle * .25);
      crownHeart.scale.setScalar(i ? 1.05 + .25 * Math.sin(i * 1.7) : 2.2);
      crownHeart.updateMatrix(); crownHearts.setMatrixAt(i, crownHeart.matrix);
      crownHearts.setColorAt(i, heartColor.set(['#df96af', '#efb9c7', '#e9c9b0'][i % 3]));
    }
    crownHearts.computeBoundingBox(); crownHearts.computeBoundingSphere(); this.tree.add(crownHearts);

    this.loveDetails = addLoveDetails(this.tree, this.scene, this.garden);
    // Authored, readable letters replace the earlier empty envelope ornaments.
    this.loveDetails.letters.forEach(letter => { letter.visible = false; });
    this.envelopes = createHangingEnvelopes(this);
    this.atmosphere.attachTree();
    this._updatePhotoThreads();
    this.resize();
    this.controls.maxDistance = this.wholeView().pos.distanceTo(this.wholeView().target);
  }

  setEnvelopes(records) { this.envelopes.setRecords(records); this._updateCards(0); this.redraw(); }

  _citySign(city) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true }));
    sign.userData.city = city; sign.scale.set(4, 1, 1);
    this._writeCitySign(sign, city.title);
    return sign;
  }

  _writeCitySign(sign, text) {
    const canvas = sign.material.map.image, c = canvas.getContext('2d'); c.clearRect(0, 0, 512, 128);
    c.fillStyle = '#fff5ef'; c.strokeStyle = '#d5a9b5'; c.lineWidth = 4;
    c.beginPath(); c.roundRect(3, 3, 506, 122, 22); c.fill(); c.stroke();
    c.fillStyle = '#805360'; c.font = 'bold 64px KaiTi, STKaiti, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 64, 464);
    sign.material.map.needsUpdate = true;
  }

  clusterCities() { return this.stories.filter(city => city.photos.some(p => this.year === null || p.year === this.year)); }

  setClusterMode(active) {
    if (active === this.clusterMode) return;
    this._finishHeartGather();
    this.cancelYearFocus();
    this.endRopeDrag();
    if (this.yearTransition) this.setYear(this.yearTransition.year);
    this.clusterMode = active; this.hoveredCity = null;
    for (const cluster of this.cityClusters) for (const card of cluster.cards) {
      (active ? cluster.group : this.cardGroup).add(card.group);
      if (!active) { card.group.position.copy(card.photo.rest); card.group.rotation.z = 0; card.group.scale.setScalar(1); card.group.visible = true; card.layoutScale = 1; }
    }
    if (!active) this.hiddenRings.clear();
    if (active) this._layoutCityClusters(); else { this.cityClusters.forEach(c => { c.group.visible = false; });  }
    this._updateCards(0); this.redraw();
  }

  _layoutCityClusters() {
    const year = card => Number.isInteger(card.photo.year) ? card.photo.year : -Infinity;
    const blocks = this.cityClusters.map(cluster => {
      const photos = cluster.cards.slice().sort((a, b) => year(b) - year(a));
      cluster.group.visible = photos.length > 0;
      cluster.cards.forEach(card => { card.group.visible = photos.includes(card); });
      return { cluster, photos, columns: Math.max(1, Math.ceil(photos.length / 7)), year: photos.length ? year(photos[0]) : -Infinity };
    }).filter(block => block.photos.length).sort((a, b) => b.year - a.year);
    const radii = [15.8, 11.6, 7.4];
    let density = 1, placements;
    // Keep each block whole; only scale down if all three rings cannot contain the catalog.
    for (;;) {
      placements = []; let ring = 0, angle = 0;
      for (const block of blocks) {
        let span = (block.columns * 2.5 + .8) * density / radii[ring];
        if (angle + span > Math.PI * 2) { ring++; angle = 0; }
        if (ring === radii.length) break;
        span = (block.columns * 2.5 + .8) * density / radii[ring];
        if (span > Math.PI * 2) break;
        placements.push({ ...block, radius: radii[ring], mid: Math.PI / 2 - .35 + angle + span / 2 });
        angle += span;
      }
      if (placements.length === blocks.length) break;
      density *= .9;
    }
    const lift = Math.max(0, Math.min(...placements.map(p => canopyHeight(p.radius) * treeHeightScale - 23.8 * treeHeightScale - .375 * density - .2))) / 2;
    for (const { cluster, photos, columns, radius, mid } of placements) {
      cluster.ringIndex = radii.indexOf(radius);
      cluster.group.position.set(Math.cos(mid) * radius, 23.8 * treeHeightScale + lift, Math.sin(mid) * radius);
      cluster.group.rotation.y = Math.PI / 2 - mid;
      cluster.label.position.y = 0; cluster.label.scale.set(Math.min(4.3, columns * 2.5) * density, .75 * density, 1);
      for (const [i, card] of photos.entries()) {
        const width = (i === 0 ? 2.15 : 1.85) * density, maxHeight = 1.35 * density;
        card.layoutScale = Math.min(width / (card.photo.w + .18 * this.heartScale), maxHeight / (card.photo.h + .27 * this.heartScale));
        card.group.scale.setScalar(card.layoutScale);
      }
      for (let i = 0; i < photos.length; i += columns) {
        const row = photos.slice(i, i + columns);
        const y = (-1.9 - Math.floor(i / columns) * 1.6) * density;
        row.forEach((card, col) => { card.group.position.set((col - (columns - 1) / 2) * 2.5 * density, y, 0); card.hangingRest = card.group.position.clone(); });
      }
      cluster.hangingTop = canopyHeight(radius) * treeHeightScale - cluster.group.position.y;
    }
    this._applyClusterVisibility();
    this.scene.updateMatrixWorld(true);
  }

  pick(x, y) {
    const photos = this.clusterMode ? [...this.trunkSigns, ...this.cityClusters.filter(c => c.group.visible).flatMap(c => [...(c.label.visible ? [c.label] : []), c.tails, ...c.cards.filter(card => card.group.visible).flatMap(card => card.group.children)])] : this._pickables;
    const pickables = [...photos, ...(this.envelopes?.pickables || [])];
    this._tmp2.set(((x - this.rect.left) / this.rect.width) * 2 - 1, -((y - this.rect.top) / this.rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this._tmp2, this.camera);
    this.raycaster.params.Line.threshold = this.camera.position.distanceTo(this.controls.target) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 16 / this.rect.height;
    const wood = this.raycaster.intersectObject(this.tree.getObjectByName('tree-main-trunk'), false)[0];
    const hit = this.raycaster.intersectObjects(pickables, false).find(hit => {
      if (wood && hit.distance > wood.distance + .01) return false;
      for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
      return true;
    });
    if (hit?.object.userData.rope) return { rope: hit.object.userData.rope.ropes[Math.floor(hit.index / 2)] };
    if (hit?.object.userData.city) return { city: hit.object.userData.city };
    if (hit?.object.userData.envelope) return { envelope: hit.object.userData.envelope, kind: 'envelope' };
    return hit?.object.userData.photo ? { photo: hit.object.userData.photo, kind: 'photo' } : null;
  }

  photoView(photo) {
    const card = this.cards.find(c => c.photo === photo);
    if (this.clusterMode) {
      this.scene.updateMatrixWorld(true);
      return super.photoView({ ...photo, rest: card.group.getWorldPosition(new THREE.Vector3()), w: photo.w * card.group.scale.x, h: photo.h * card.group.scale.y });
    }
    const scale = this.layoutMode === 'carousel' ? carouselPhotoScale : 1;
    const view = super.photoView({ ...photo, w: photo.w * scale, h: photo.h * scale }), distance = view.pos.distanceTo(view.target);
    const offset = photo.rest.clone().setY(0).setLength(distance); offset.y = .04;
    return { target: photo.rest.clone(), pos: photo.rest.clone().add(offset) };
  }

  storyView(city) {
    const cards = this.cards.filter(card => card.photo.story === city && (this.year === null || card.photo.year === this.year));
    const dir = this.layoutMode === 'carousel' && !this.clusterMode ? new THREE.Vector3(Math.cos(city.sector.mid), -.1, Math.sin(city.sector.mid)).normalize() : null;
    return this._frontView(cards, false, dir);
  }

  _frontView(cards, whole = false, direction = null) {
    if (!cards.length) return { pos: new THREE.Vector3(0, 12, 44), target: new THREE.Vector3(0, 12, 0) };
    this.scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3(), points = [], scale = this.layoutMode === 'carousel' ? carouselPhotoScale : 1;
    for (const card of cards) {
      if (this.clusterMode) bounds.expandByObject(card.plate);
      else for (const x of [-1, 1]) for (const y of [-1, 1]) bounds.expandByPoint(new THREE.Vector3(card.photo.rest.x + x * (card.photo.w / 2 + .12 * this.heartScale) * scale, card.photo.rest.y + y * (card.photo.h / 2 + .17 * this.heartScale) * scale, card.photo.rest.z));
    }
    const target = bounds.getCenter(new THREE.Vector3()), dir = direction || new THREE.Vector3(0, 0, 1);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z));
    const phone = this.width / this.height < .8;
    const box = whole ? { x0: -.86, x1: .86, y0: phone ? -.6 : -.79, y1: phone ? .62 : .76 } : { x0: -.8, x1: .8, y0: -.65, y1: .7 };
    const distance = Math.max(whole ? 16 : 4, this._fit(points, target, dir, box));
    return { pos: target.clone().addScaledVector(dir, distance), target };
  }

  _layoutBranches() {
    const heart = heartLayout(this.photos);
    this.heartScale = .78;
    this.photos.forEach((photo, i) => { photo.w = heart[i].w * this.heartScale; photo.h = heart[i].h * this.heartScale; });
    const carousel = carouselLayout(this.photos, this.stories, canopyHeight, treeHeightScale);
    const bottom = Math.min(...carousel.positions.map(p => p.y));
    const span = Math.max(...carousel.positions.map(p => p.y)) - bottom;
    this.layoutPositions = {
      heart: heart.map(p => {
        const position = new THREE.Vector3(p.x * .74, 2.1 + p.y * .54, p.z * .74);
        // Keep the heart on the tree axis, moving only its central cards clear
        // of the wood; the lowest tip stays in front of the roots.
        const clearance = 1.65 + 1.15 * Math.max(0, 1 - position.y / 4);
        const radius = Math.hypot(position.x, position.z);
        if (radius < clearance) {
          if (position.y < 2.5) position.z = Math.sqrt(clearance ** 2 - position.x ** 2);
          else { position.x *= clearance / radius; position.z *= clearance / radius; }
        }
        return position;
      }),
      carousel: carousel.positions.map(p => new THREE.Vector3(p.x * 1.06, span ? 2.9 + (p.y - bottom) / span * 12.5 : 9, p.z * 1.06)),
    };
    this.layoutMode = 'carousel'; this.heartGather = null;
    this.stories.forEach((city, i) => { city.sector = carousel.sectors[i]; });
    this.photos.forEach((photo, i) => {
      photo.rest = this.layoutPositions.carousel[i].clone();
      photo.anchorY = canopyHeight(Math.hypot(photo.rest.x, photo.rest.z)) * treeHeightScale; photo.phase = carousel.positions[i].phase;
    });
    this.photoLift = carousel.photoLift;
  }

  setYear(year) {
    this.cancelYearFocus(false);
    this.endRopeDrag();
    this.yearTransition = null;
    this.year = year;
    if (this.clusterMode) this._applyClusterVisibility();
    this._updateCards(0); this.redraw();
  }
  setFocusStory(city) { if (city) this._finishHeartGather(); super.setFocusStory(city); this.hoveredCity = null; this._updateCards(0); this.redraw(); }
  setSelected(photo) { if (photo) this._finishHeartGather(); super.setSelected(photo); this._updateCards(0); this.redraw(); }

  _applyClusterVisibility() {
    for (const cluster of this.cityClusters) {
      cluster.cards.forEach(card => { card.group.visible = true; });
      cluster.group.visible = !this.hiddenRings.has(cluster.ringIndex) && cluster.cards.some(card => card.group.visible);
      this._trimClusterStrings(cluster);
    }

  }

  _trimClusterStrings(cluster) {
    const bottoms = new Map(), points = [], tails = [];
    for (const card of cluster.cards) {
      if (!card.group.visible) continue;
      const x = card.hangingRest.x;
      const bottom = card.hangingRest.y - ((card.photo.h + .27 * this.heartScale) / 2 + .035) * card.layoutScale;
      if (!bottoms.has(x) || bottom < bottoms.get(x).bottom) bottoms.set(x, { bottom, length: card.photo.h * card.layoutScale / 3 });
    }
    cluster.hangingBottom = bottoms.size ? Math.min(...[...bottoms.values()].map(b => b.bottom - b.length)) : 0;
    const previous = new Map(cluster.ropes.map(rope => [rope.x, rope]));
    const density = cluster.label.scale.y / .75;
    cluster.ropes = [...bottoms].map(([x, { bottom, length }]) => {
      const rope = previous.get(x) || { cluster, x, angle: 0, velocity: 0 };
      rope.top = cluster.hangingTop; rope.bottom = bottom - length;
      // Longer, tightly spaced columns stop sooner to avoid crossing neighbours.
      const travel = (bottoms.size > 1 ? 1.2 : 1.6) * density;
      rope.limit = Math.min(Math.PI / 12, Math.asin(Math.min(1, travel / (rope.top - rope.bottom))));
      return rope;
    });
    const ropesByX = new Map(cluster.ropes.map(rope => [rope.x, rope]));
    for (const card of cluster.cards) card.rope = ropesByX.get(card.hangingRest.x);
    for (const [x, { bottom, length }] of bottoms) {
      for (let segment = 0; segment < 12; segment++) points.push(x, cluster.hangingTop + (bottom - cluster.hangingTop) * segment / 12, -.06, x, cluster.hangingTop + (bottom - cluster.hangingTop) * (segment + 1) / 12, -.06);
      tails.push(x, bottom, -.06, x, bottom - length, -.06);
    }
    cluster.strings.geometry.dispose(); cluster.strings.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    cluster.stringRest = cluster.strings.geometry.attributes.position.array.slice();
    cluster.tails.geometry.dispose(); cluster.tails.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tails, 3));
    cluster.tailRest = cluster.tails.geometry.attributes.position.array.slice();
  }

  beginRopeDrag(rope, x, y) {
    this.cancelYearFocus();
    this.endRopeDrag();
    if (this.yearTransition) this.setYear(this.yearTransition.year);
    if (this.flight) { this.flight = null; this.controls.enabled = true; }
    const cluster = rope.cluster;
    this.scene.updateMatrixWorld(true);
    const center = cluster.group.getWorldPosition(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()), center);
    this.ropeDrag = { rope, cluster, plane, start: 0, angle: rope.angle, controlsEnabled: this.controls.enabled, updateControls: this.controls.update };
    this.ropeDrag.start = this._ropePointerX(x, y);
    this.controls.enabled = false; this.controls.autoRotate = false;
    // OrbitControls still integrates damping when disabled; freeze its update too.
    this.controls.update = () => false;
    rope.velocity = 0; this.setHovered(null);
  }

  _ropePointerX(x, y) {
    this._tmp2.set(((x - this.rect.left) / this.rect.width) * 2 - 1, -((y - this.rect.top) / this.rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this._tmp2, this.camera);
    const point = this.raycaster.ray.intersectPlane(this.ropeDrag.plane, new THREE.Vector3());
    return point ? this.ropeDrag.cluster.group.worldToLocal(point).x : this.ropeDrag.start;
  }

  moveRopeDrag(x, y) {
    if (!this.ropeDrag) return;
    const d = this.ropeDrag, limit = this.reducedMotion ? Math.min(d.rope.limit, Math.PI / 36) : d.rope.limit;
    const length = d.rope.top - d.rope.bottom;
    const displacement = length * Math.sin(d.angle) + this._ropePointerX(x, y) - d.start;
    d.rope.angle = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(displacement / length, -1, 1)), -limit, limit);
    this.redraw();
  }

  endRopeDrag() {
    if (!this.ropeDrag) return;
    this.controls.enabled = this.ropeDrag.controlsEnabled;
    this.controls.update = this.ropeDrag.updateControls;
    this.ropeDrag = null; this.redraw();
  }

  setRingVisible(index, visible) {
    this.cancelYearFocus();
    if (visible) this.hiddenRings.delete(index); else this.hiddenRings.add(index);
    if (this.clusterMode) this._applyClusterVisibility();
    this._updateCards(0); this.redraw();
  }

  cancelYearFocus(applyYear = true) {
    if (!this.yearTransition) return;
    const year = this.yearTransition.year;
    this.yearTransition = null; this.flight = null; this.controls.enabled = true;
    if (applyYear && this.year !== year) this.setYear(year);
  }

  flyTo(view, duration = 1.5) {
    if (this.heartGather) {
      const whole = this.wholeView();
      if (view.target.distanceTo(whole.target) > .01 || view.pos.distanceTo(whole.pos) > .01) this._finishHeartGather();
    }
    this.cancelYearFocus(); super.flyTo(view, duration);
  }

  _yearCityView(cards) { return this._frontView(cards); }

  flyToYear(year) {
    if (Number.isInteger(year)) this.atmosphere.pulseYear();
    if (year !== null) this._finishHeartGather();
    this.setYear(null);
    this.scene.updateMatrixWorld(true);
    const cards = this.cards.filter(card => (year === null || card.photo.year === year) && (!this.clusterMode || !this.hiddenRings.has(this.cityClusters.find(c => c.city === card.photo.story).ringIndex)));
    this.flyTo(year === null ? this.wholeView() : this._yearCityView(cards), 1);
    this.yearTransition = { year, flight: this.flight };
  }

  setLayoutMode(mode, animate = true) {
    if (mode !== 'heart' && mode !== 'carousel') return;
    this.cancelYearFocus(false); this.endRopeDrag();
    this.flight = null; this.controls.enabled = true; this.controls.autoRotate = false; this.rotationActive = false;
    this.scene.updateMatrixWorld(true);
    const starts = this.cards.map(card => card.group.getWorldPosition(new THREE.Vector3()));
    this.heartGather = null;
    const clustered = this.clusterMode; this.clusterMode = false;
    this.layoutMode = mode; this.hiddenRings.clear();
    this.tree.getObjectByName('tree-main-trunk').visible = true;
    this.tree.getObjectByName('tree-root-contact-shadow').visible = true;
    this.trunkKeepsakes.visible = true;
    this.garden.setHeartMode(mode === 'heart');
    this.year = null; this.focusStory = null; this.selected = null; this.hovered = null; this.hoveredCity = null;
    this.cityClusters.forEach(cluster => { cluster.group.visible = false; });
    this.cards.forEach((card, i) => {
      if (clustered) card.yaw += card.group.parent.rotation.y;
      this.cardGroup.add(card.group); card.group.position.copy(this.cardGroup.worldToLocal(starts[i]));
      card.group.rotation.z = 0; card.group.visible = true; card.group.scale.setScalar(1); card.layoutScale = 1;
      card.photo.rest.copy(this.layoutPositions[mode][i]);
      card.photo.anchorY = canopyHeight(Math.hypot(card.photo.rest.x, card.photo.rest.z)) * treeHeightScale;
    });
    this.heartGather = animate && !this.reducedMotion ? { elapsed: 0, starts, mode } : null;
    if (!this.heartGather) this.cards.forEach(card => card.group.position.copy(card.photo.rest));
    const whole = this.wholeView(); this.controls.maxDistance = whole.pos.distanceTo(whole.target);
    this._updateCards(0); this.redraw();
  }

  gatherHeart() { this.setLayoutMode('heart'); }

  _finishHeartGather() {
    if (!this.heartGather) return;
    this.heartGather = null;
    for (const card of this.cards) { card.group.position.copy(card.photo.rest); card.group.rotation.set(0, 0, 0); card.yaw = 0; }
  }

  _updateHeartGather(dt) {
    if (!this.heartGather || this.clusterMode) return;
    const gather = this.heartGather; gather.elapsed += dt;
    this.cards.forEach((card, i) => {
      const t = THREE.MathUtils.clamp((gather.elapsed - i / Math.max(1, this.cards.length - 1) * .42) / 1.85, 0, 1);
      const ease = 1 - (1 - t) ** 3;
      const start = gather.starts[i], end = card.photo.rest;
      const from = Math.atan2(start.z, start.x), delta = Math.atan2(end.z, end.x) - from;
      const angle = from + Math.atan2(Math.sin(delta), Math.cos(delta)) * ease;
      const radius = THREE.MathUtils.lerp(Math.hypot(start.x, start.z), Math.hypot(end.x, end.z), ease);
      card.group.position.set(Math.cos(angle) * radius, THREE.MathUtils.lerp(start.y, end.y, ease), Math.sin(angle) * radius);
    });
    if (gather.elapsed >= 2.27) this._finishHeartGather();
  }

  _updateFlight(now) {
    const transition = this.yearTransition;
    super._updateFlight(now);
    if (transition && transition.flight === this.yearTransition?.flight && !this.flight) this.setYear(transition.year);
  }

  setRotation(active, direction, speed) {
    this.cancelYearFocus();
    this.rotationActive = active; this.rotationDirection = direction; this.rotationSpeed = speed;
    this.controls.autoRotate = active; this.controls.autoRotateSpeed = .35 * direction * speed;
    this.redraw();
  }

  _updateHanging(dt) {
    const step = Math.min(dt, .1);
    this.controls.autoRotate = this.rotationActive && !this.flight && !this.ropeDrag;
    this.hangingTime += step;
    const wanted = this.rotationActive && !this.flight && !this.ropeDrag && !this.reducedMotion ? .16 * this.rotationSpeed : 0;
    const previous = this.hangingAmplitude;
    this.hangingAmplitude += (wanted - this.hangingAmplitude) * (1 - Math.exp(-step * 3));
    if (this.hangingAmplitude < .00001) this.hangingAmplitude = 0;
    if (!this.clusterMode) return;
    this.cityClusters.forEach((cluster, index) => {
      if (!cluster.group.visible) return;
      if (previous === 0 && this.hangingAmplitude === 0 && !cluster.ropes.some(rope => rope.angle || rope.velocity)) return;
      for (const rope of cluster.ropes) if (this.ropeDrag?.rope !== rope && (rope.angle || rope.velocity)) {
        rope.velocity += (-22 * rope.angle - (this.reducedMotion ? 10 : 5) * rope.velocity) * step;
        rope.angle += rope.velocity * step;
        if (Math.abs(rope.angle) + Math.abs(rope.velocity) < .000001) rope.angle = rope.velocity = 0;
      }
      const offset = y => {
        const depth = Math.max(0, (cluster.hangingTop - y) / (cluster.hangingTop - cluster.hangingBottom));
        return this.hangingAmplitude * depth * Math.sin(this.hangingTime * 1.3 + index * 1.7 + depth * 1.4) * this.rotationDirection;
      };
      const transform = (x, y, z, rope) => {
        const angle = rope?.angle || 0, length = cluster.hangingTop - y;
        return this._clusterPoint.set(x + length * Math.sin(angle) + offset(y), y + length * (1 - Math.cos(angle)), z);
      };
      cluster.label.position.x = offset(cluster.label.position.y);
      for (const card of cluster.cards) if (card.group.visible) {
        const p = card.hangingRest; card.group.position.copy(transform(p.x, p.y, p.z, card.rope));
        card.group.rotation.z = (card.rope?.angle || 0) + offset(p.y) * .04;
      }
      const position = cluster.strings.geometry.attributes.position;
      for (let i = 0; i < position.count; i++) {
        const p = transform(cluster.stringRest[i * 3], cluster.stringRest[i * 3 + 1], cluster.stringRest[i * 3 + 2], cluster.ropes[Math.floor(i / 24)]);
        position.setXYZ(i, p.x, p.y, p.z);
      }
      position.needsUpdate = true;
      const tailPosition = cluster.tails.geometry.attributes.position;
      for (let i = 0; i < tailPosition.count; i++) {
        const p = transform(cluster.tailRest[i * 3], cluster.tailRest[i * 3 + 1], cluster.tailRest[i * 3 + 2], cluster.ropes[Math.floor(i / 2)]);
        tailPosition.setXYZ(i, p.x, p.y, p.z);
      }
      tailPosition.needsUpdate = true;
      cluster.strings.geometry.computeBoundingSphere(); cluster.tails.geometry.computeBoundingSphere();
    });
  }

  _updateCards(dt) {
    this._updateHeartGather(dt);
    this.atmosphere.update(dt);
    this.loveDetails?.update(this.atmosphere.effectTime, this.atmosphere.enabled && !this.reducedMotion);
    this._updateHanging(dt);
    const k = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 7);
    for (const card of this.cards) {
      const p = card.photo;
      card.dim = (this.year !== null && p.year !== this.year) || (this.focusStory && p.story !== this.focusStory) ? 1 : 0;
      if (p === this.selected) card.dim = 0;
      const weak = this.clusterMode && this.year === null && !this.focusStory && this.hoveredCity && p.story !== this.hoveredCity;
      card.mat.color.setScalar(card.loaded ? (card.dim ? .26 : weak ? .65 : 1) : .45);
      const position = card.group.getWorldPosition(this._clusterPoint);
      const want = Math.atan2(this.camera.position.x - position.x, this.camera.position.z - position.z) - (this.clusterMode ? card.group.parent.rotation.y : 0);
      card.yaw += Math.atan2(Math.sin(want - card.yaw), Math.cos(want - card.yaw)) * k;
      card.group.rotation.y = card.yaw;
      if (!this.clusterMode && !this.heartGather) card.group.position.copy(p.rest);
      card.group.scale.setScalar((this.clusterMode ? card.layoutScale || 1 : this.layoutMode === 'carousel' ? carouselPhotoScale : 1) * (p === this.hovered || p === this.selected ? 1.04 : 1));
    }
    for (const sign of this.trunkSigns || []) {
      const city = sign.userData.city;
      const dim = (this.focusStory && city !== this.focusStory) || (this.year !== null && !city.photos.some(photo => photo.year === this.year));
      sign.material.color.setScalar(dim ? .35 : 1);
    }
    if (this.clusterMode) this._updateCityOcclusion();
    this.envelopes?.update(this.atmosphere.effectTime, this.atmosphere.enabled && !this.reducedMotion, this.year, dt);
    this._updatePhotoThreads();
  }

  _updatePhotoThreads() {
    if (!this.photoThreads) return;
    this.photoThreads.visible = !this.clusterMode;
    this.threadHearts.visible = !this.clusterMode;
    if (this.atmosphere.heartSparkles) this.atmosphere.heartSparkles.visible = !this.clusterMode;
    if (this.clusterMode) return;
    this.cardGroup.updateMatrixWorld(true); this.tree.updateWorldMatrix(true, false);
    const positions = this.photoThreads.geometry.attributes.position;
    this.cards.forEach((card, i) => {
      const end = this._threadEnd.set(0, card.clip.geometry.parameters.height / 2, 0);
      card.clip.localToWorld(end);
      const neck = this._threadNeck.copy(end); neck.y += .06 * this.heartScale; neck.z -= .3 * this.heartScale;
      const anchor = this._threadAnchor.copy(neck); this.tree.worldToLocal(anchor);
      anchor.y = canopyHeight(Math.hypot(anchor.x, anchor.z)); this.tree.localToWorld(anchor);
      positions.setXYZ(i * 4, anchor.x, anchor.y, anchor.z);
      positions.setXYZ(i * 4 + 1, neck.x, neck.y, neck.z);
      positions.setXYZ(i * 4 + 2, neck.x, neck.y, neck.z);
      positions.setXYZ(i * 4 + 3, end.x, end.y, end.z);
      const heart = this._threadOrnament;
      heart.position.copy(anchor).lerp(neck, .28 + (i * .618034 % 1) * .55);
      heart.rotation.y = Math.atan2(this.camera.position.x - heart.position.x, this.camera.position.z - heart.position.z);
      heart.scale.setScalar(.13 + i % 3 * .025); heart.updateMatrix();
      this.threadHearts.setMatrixAt(i, heart.matrix);
      const atmosphere = this.atmosphere;
      if (atmosphere.heartSparkles && i % atmosphere.sparkleStride === 0) {
        const sparkle = atmosphere.sparkleObject;
        sparkle.position.copy(heart.position); sparkle.position.y += .075;
        sparkle.position.x += Math.sin(heart.rotation.y) * .07; sparkle.position.z += Math.cos(heart.rotation.y) * .07;
        sparkle.rotation.set(0, heart.rotation.y, 0);
        const shine = atmosphere.enabled ? ((1 + Math.sin(atmosphere.effectTime * .8 + i * 1.7)) * .5) ** 5 : .25;
        sparkle.scale.setScalar(.18 + shine * (.2 + atmosphere.mix * .28)); sparkle.updateMatrix();
        atmosphere.heartSparkles.setMatrixAt(i / atmosphere.sparkleStride, sparkle.matrix);
      }
    });
    positions.needsUpdate = true; this.photoThreads.geometry.computeBoundingSphere();
    if (this.atmosphere.heartSparkles) this.atmosphere.heartSparkles.instanceMatrix.needsUpdate = true;
    this.threadHearts.instanceMatrix.needsUpdate = true; this.threadHearts.computeBoundingSphere();
  }

  _updateCityOcclusion() {
    this.scene.updateMatrixWorld(true); this.camera.updateMatrixWorld();
    for (const cluster of this.cityClusters) {
      for (const card of cluster.cards) card.group.visible = true;
      cluster.label.visible = true;
      cluster.group.visible = !this.hiddenRings.has(cluster.ringIndex) && cluster.cards.some(card => card.group.visible);
    }
    if (!this.focusStory && this.year !== null) {
      // Snapshot photo bounds before hiding anything; only nearer, outer-ring photos yield.
      const photos = [];
      for (const cluster of this.cityClusters) if (cluster.group.visible) for (const card of cluster.cards) {
        const world = new THREE.Box3().setFromObject(card.plate), screen = new THREE.Box2();
        for (const x of [world.min.x, world.max.x]) for (const y of [world.min.y, world.max.y]) for (const z of [world.min.z, world.max.z]) {
          const point = new THREE.Vector3(x, y, z).project(this.camera);
          screen.expandByPoint(new THREE.Vector2(point.x, point.y));
        }
        const depth = -card.group.getWorldPosition(new THREE.Vector3()).applyMatrix4(this.camera.matrixWorldInverse).z;
        if (depth > 0) photos.push({ card, ring: cluster.ringIndex, screen, depth });
      }
      const targets = photos.filter(p => p.ring > 0 && p.card.photo.year === this.year);
      for (const photo of photos) if (targets.some(target => photo.ring < target.ring && photo.depth < target.depth - .05 && photo.screen.intersectsBox(target.screen))) photo.card.group.visible = false;
      return;
    }
    const selected = this.cityClusters.find(c => c.city === this.focusStory);
    if (!selected?.group.visible || selected.ringIndex === 0) return;
    // Compare the displayed photo/sign blocks, never the long empty hanging cords.
    const project = cluster => {
      const world = new THREE.Box3(), screen = new THREE.Box2();
      for (const card of cluster.cards) if (card.group.visible) world.expandByObject(card.plate);
      for (const x of [world.min.x, world.max.x]) for (const y of [world.min.y, world.max.y]) for (const z of [world.min.z, world.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(this.camera);
        screen.expandByPoint(new THREE.Vector2(point.x, point.y));
      }
      const point = cluster.label.getWorldPosition(new THREE.Vector3());
      const depth = -point.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
      const v = point.project(this.camera), h = cluster.label.scale.y / (2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
      const w = h * cluster.label.scale.x / cluster.label.scale.y / this.camera.aspect;
      screen.expandByPoint(new THREE.Vector2(v.x - w, v.y - h)); screen.expandByPoint(new THREE.Vector2(v.x + w, v.y + h));
      return { screen, depth };
    };
    const target = project(selected);
    for (const cluster of this.cityClusters) {
      if (!cluster.group.visible || cluster.ringIndex >= selected.ringIndex) continue;
      const front = project(cluster);
      if (front.depth > 0 && front.depth < target.depth - .05 && front.screen.intersectsBox(target.screen)) cluster.group.visible = false;
    }
  }

  wholeView(azimuth = .35) {
    if (!this.clusterMode) {
      const points = this._wholePoints(), bounds = new THREE.Box3().setFromPoints(points);
      const target = bounds.getCenter(new THREE.Vector3());
      const dir = this.layoutMode === 'carousel' ? new THREE.Vector3(Math.sin(azimuth), .13, Math.cos(azimuth)).normalize() : new THREE.Vector3(0, 0, 1);
      const phone = this.width / this.height < .8;
      const distance = this._fit(points, target, dir, { x0: -.86, x1: .86, y0: phone ? -.6 : -.79, y1: phone ? .62 : .76 });
      return { pos: target.clone().addScaledVector(dir, distance), target };
    }
    if (this.clusterMode) {
      const bounds = new THREE.Box3();
      for (const cluster of this.cityClusters) if (cluster.group.visible) {
        bounds.expandByObject(cluster.label);
        for (const card of cluster.cards) if (card.group.visible) bounds.expandByObject(card.group);
      }
      if (!bounds.isEmpty()) {
        const target = bounds.getCenter(new THREE.Vector3()), dir = new THREE.Vector3(Math.sin(azimuth), .06, Math.cos(azimuth));
        target.y = Math.min(target.y, 17);
        const points = [];
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z));
        const distance = Math.max(16, this._fit(points, target, dir, { x0: Math.max(-.6, 660 / this.width - 1), x1: .85, y0: -.72, y1: .72 }));
        return { pos: target.clone().addScaledVector(dir, distance), target };
      }
    }
    return this._frontView(this.cards, true);
  }

  resize() {
    const changed = this.width !== window.innerWidth || this.height !== window.innerHeight;
    super.resize();
    if (!changed || !this.cards?.length) return;
    this._finishHeartGather();
    if (this.yearTransition) this.setYear(this.yearTransition.year);
    const whole = this.wholeView();
    this.controls.maxDistance = whole.pos.distanceTo(whole.target);
    const view = this.selected ? this.photoView(this.selected) : this.focusStory ? this.storyView(this.focusStory) : this.year !== null ? this._yearCityView(this.cards.filter(card => card.photo.year === this.year)) : this.wholeView();
    this.flight = null; this.yearTransition = null; this.controls.enabled = true;
    this.camera.position.copy(view.pos); this.controls.target.copy(view.target); this.camera.lookAt(view.target);
    this.redraw();
  }

  _clampCamera() {
    if (this.ropeDrag) return;
    const target = this.controls.target, camera = this.camera.position;
    target.x = THREE.MathUtils.clamp(target.x, -24, 24); target.z = THREE.MathUtils.clamp(target.z, -16, 16); target.y = THREE.MathUtils.clamp(target.y, .4, 26);
    camera.y = THREE.MathUtils.clamp(camera.y, .3, 40);
    const radius = Math.hypot(camera.x, camera.z);
    const maxRadius = this.controls.maxDistance;
    if (radius > maxRadius) { camera.x *= maxRadius / radius; camera.z *= maxRadius / radius; }
  }

  _wholePoints() {
    const points = [], scale = this.layoutMode === 'carousel' ? carouselPhotoScale : 1;
    for (const photo of this.photos) for (const x of [-1, 1]) for (const y of [-1, 1]) points.push(new THREE.Vector3(photo.rest.x + x * (photo.w / 2 + .12 * this.heartScale) * scale, photo.rest.y + y * (photo.h / 2 + .17 * this.heartScale) * scale, photo.rest.z));
    if (this.tree) {
      const bounds = new THREE.Box3().setFromObject(this.tree);
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }
}

import * as THREE from 'three';

// Small independent atmosphere layer. Photos keep their unlit, original-color material.
export class TreeAtmosphere {
  constructor(owner) {
    this.owner = owner; this.night = false; this.enabled = !owner.reducedMotion;
    this.mix = 0; this.effectTime = 0; this.slowSeconds = 0; this.pulseAge = 2;
    this.lowDensity = innerWidth <= 760 || (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
    this.group = new THREE.Group(); this.group.name = 'quiet-tree-atmosphere'; owner.scene.add(this.group);
    this.sky = owner.scene.children.find(object => object.material?.uniforms?.topColor);
    this.lights = owner.scene.children.filter(object => object.isLight).map(light => ({ light, day: light.intensity }));
    this.colors = {
      daySky: new THREE.Color('#f2dce3'), nightSky: new THREE.Color('#172332'),
      dayHorizon: new THREE.Color('#fff6ed'), nightHorizon: new THREE.Color('#34414c'),
      dayFog: new THREE.Color('#faf3ef'), nightFog: new THREE.Color('#24303b'),
      dayGround: new THREE.Color('#e8ddd1'), nightGround: new THREE.Color('#596169'),
    };
    this.fogRGB = { r: 0, g: 0, b: 0 };
    this.photoGlow = new THREE.Color('#fff0da');
    this.flowerNight = { value: 0 };
    const flowers = owner.garden.meadow.wildflowers.flowers.material;
    flowers.uniforms.uAtmosphereNight = this.flowerNight;
    flowers.fragmentShader = 'uniform float uAtmosphereNight;\n' + flowers.fragmentShader.replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb *= mix(1.0, .25, uAtmosphereNight);\n#include <tonemapping_fragment>');
    this.grassBrightness = owner.garden.meadow.blades.uniforms.uBrightness;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const c = canvas.getContext('2d'), glow = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, '#fff8dd'); glow.addColorStop(.13, '#fff4cccb'); glow.addColorStop(.45, '#ffe2a82b'); glow.addColorStop(1, '#ffe2a800');
    c.fillStyle = glow; c.fillRect(0, 0, 64, 64);
    this.glowMap = new THREE.CanvasTexture(canvas); this.glowMap.colorSpace = THREE.SRGBColorSpace;
    let seed = 74123;
    const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const stars = new Float32Array(72 * 3);
    for (let i = 0; i < 72; i++) {
      const angle = rand() * Math.PI * 2, y = .12 + rand() * .8, r = Math.sqrt(1 - y * y) * 104;
      stars.set([Math.cos(angle) * r, y * 104, Math.sin(angle) * r], i * 3);
    }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(stars, 3)), new THREE.PointsMaterial({ color: '#d9dfe2', size: .19, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.name = 'quiet-night-stars'; this.stars.frustumCulled = false;
    this.stars.onBeforeRender = (_renderer, _scene, camera) => { this.stars.position.copy(camera.position); this.stars.updateMatrixWorld(true); };
    this.group.add(this.stars);
    this.flyRest = [];
    const flyPositions = new Float32Array(42 * 3);
    for (let i = 0; i < 42; i++) {
      const angle = i * 2.39996 + rand() * .3, radius = 9.5 + rand() * 5.5;
      const point = new THREE.Vector3(Math.cos(angle) * radius, 2.5 + rand() * 8, Math.sin(angle) * radius);
      this.flyRest.push(point); flyPositions.set(point.toArray(), i * 3);
    }
    this.fireflies = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(flyPositions, 3)), new THREE.PointsMaterial({ color: '#e7ce98', map: this.glowMap, size: 1.05, transparent: true, opacity: 0, depthWrite: false }));
    this.fireflies.name = 'quiet-golden-fireflies'; this.fireflies.frustumCulled = false; this.group.add(this.fireflies);
    this.petals = new THREE.Group(); this.petals.name = 'quiet-day-petals'; this.group.add(this.petals);
    const petalGeometry = new THREE.SphereGeometry(.075, 6, 4).scale(.65, 1.5, .12);
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(petalGeometry, new THREE.MeshBasicMaterial({ color: i % 2 ? '#e0b3c1' : '#ecd0cd', transparent: true, opacity: .45, side: THREE.DoubleSide }));
      mesh.position.set((i % 2 ? 1 : -1) * (13 + rand() * 4), 2 + i * 2.9, -1 + rand() * 5);
      mesh.userData.rest = mesh.position.clone(); mesh.rotation.set(i, i * .7, i * .4); this.petals.add(mesh);
    }
    this.rim = new THREE.DirectionalLight('#cbd8e5', 0); this.rim.name = 'quiet-canopy-rim'; this.rim.position.set(4, 24, -12);
    this.rim.target.position.set(0, 17, 0); owner.scene.add(this.rim, this.rim.target);
    this.pathLights = new THREE.Group(); this.pathLights.name = 'path-memory-lights'; this.group.add(this.pathLights);
    const markerGeometry = new THREE.SphereGeometry(.09, 8, 6);
    for (let i = 0; i < 3; i++) {
      const angle = Math.PI / 2 + (i - 1) * .5, x = Math.cos(angle) * 9.6, z = Math.sin(angle) * 9.6;
      const marker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: '#e3c993' })); marker.position.set(x, .14, z);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: this.glowMap, color: '#e5c38c', transparent: true, opacity: .22, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x, .035, z); this.pathLights.add(marker, pool);
    }
    this.halo = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.15, 96), new THREE.MeshBasicMaterial({ color: '#e2c7a6', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
    this.halo.name = 'year-soft-halo'; this.halo.rotation.x = -Math.PI / 2; this.halo.position.y = .045; this.group.add(this.halo);
    this.leafUniforms = { time: { value: 0 }, motion: { value: 0 } };
    this.applyDensity(); this.update(0);
  }

  attachTree() {
    for (const card of this.owner.cards) card.plate.material.emissive.copy(this.photoGlow);
    const sparkleCanvas = document.createElement('canvas'); sparkleCanvas.width = sparkleCanvas.height = 64;
    const c = sparkleCanvas.getContext('2d'), glow = c.createRadialGradient(32, 32, 0, 32, 32, 30);
    glow.addColorStop(0, '#fffdf4'); glow.addColorStop(.18, '#fff5d9e6'); glow.addColorStop(.6, '#fff0cb50'); glow.addColorStop(1, '#fff0cb00');
    c.fillStyle = glow; c.beginPath(); c.moveTo(32, 1); c.quadraticCurveTo(35, 28, 63, 32); c.quadraticCurveTo(35, 35, 32, 63); c.quadraticCurveTo(29, 35, 1, 32); c.quadraticCurveTo(29, 29, 32, 1); c.fill();
    const map = new THREE.CanvasTexture(sparkleCanvas); map.colorSpace = THREE.SRGBColorSpace;
    this.heartSparkles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map, color: '#fff4df', transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide }), Math.ceil(this.owner.cards.length / 3));
    this.heartSparkles.name = 'heart-jewel-sparkles'; this.heartSparkles.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.heartSparkles.frustumCulled = false;
    this.sparkleObject = new THREE.Object3D(); this.owner.scene.add(this.heartSparkles); this.applyDensity();
    const leaves = this.owner.tree.getObjectByName('tree-leaf-crown');
    leaves.material.onBeforeCompile = shader => {
      shader.uniforms.uAtmosphereTime = this.leafUniforms.time; shader.uniforms.uAtmosphereMotion = this.leafUniforms.motion;
      shader.vertexShader = 'uniform float uAtmosphereTime; uniform float uAtmosphereMotion;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 leafCenter = instanceMatrix[3].xyz;
        transformed.x += position.y * sin(uAtmosphereTime * .65 + leafCenter.x * .27 + leafCenter.z * .19) * .16 * uAtmosphereMotion;
        transformed.z += position.x * cos(uAtmosphereTime * .51 + leafCenter.z * .23) * .11 * uAtmosphereMotion;`);
    };
    leaves.material.customProgramCacheKey = () => 'quiet-leaf-breeze-v1';
  }

  applyDensity() {
    this.stars.geometry.setDrawRange(0, this.lowDensity ? 32 : 72);
    this.fireflies.geometry.setDrawRange(0, this.lowDensity ? 16 : 42);
    if (this.heartSparkles) { this.sparkleStride = this.lowDensity ? 6 : 3; this.heartSparkles.count = Math.ceil(this.owner.cards.length / this.sparkleStride); }
    this.petals.children.forEach((petal, i) => { petal.visible = i < (this.lowDensity ? 2 : 6); });
  }

  set(night, enabled) {
    this.night = night; this.enabled = enabled && !this.owner.reducedMotion;
    if (!this.enabled || !this.owner._drawn) this.mix = night ? 1 : 0;
    if (!this.enabled) this.pulseAge = 2;
    this.owner.garden.setMotionEnabled(this.enabled);
    this.update(0); this.owner.redraw();
  }

  pulseYear() { if (this.enabled) this.pulseAge = 0; }

  update(dt) {
    const step = Math.min(Math.max(dt, 0), .1), active = this.enabled && !this.owner.reducedMotion;
    if (active) this.effectTime += step;
    if (!this.lowDensity && this.owner.running) {
      this.slowSeconds = dt > .04 ? this.slowSeconds + step : Math.max(0, this.slowSeconds - step * .5);
      if (this.slowSeconds > 2) { this.lowDensity = true; this.applyDensity(); }
    }
    this.mix += ((this.night ? 1 : 0) - this.mix) * (active ? 1 - Math.exp(-step * 2.2) : 1);
    if (Math.abs(this.mix - (this.night ? 1 : 0)) < .001) this.mix = this.night ? 1 : 0;
    const n = this.mix, t = this.effectTime;
    if (this.sky) {
      this.sky.material.uniforms.topColor.value.lerpColors(this.colors.daySky, this.colors.nightSky, n);
      this.sky.material.uniforms.horizonColor.value.lerpColors(this.colors.dayHorizon, this.colors.nightHorizon, n);
    }
    this.owner.scene.background.lerpColors(this.colors.dayFog, this.colors.nightFog, n);
    this.owner.scene.fog.color.copy(this.owner.scene.background);
    this.owner.scene.fog.color.getRGB(this.fogRGB, THREE.SRGBColorSpace); this.owner.common.uFogColor.value.set(this.fogRGB.r, this.fogRGB.g, this.fogRGB.b);
    this.owner.garden.meadow.surface.material.color.lerpColors(this.colors.dayGround, this.colors.nightGround, n);
    const daylight = active ? Math.sin(t * .12) * .008 * (1 - n) : 0;
    for (const { light, day } of this.lights) light.intensity = day * (1 - n * (light.isHemisphereLight ? .57 : .82) + daylight);
    this.rim.intensity = n * .28;
    this.flowerNight.value = n; this.grassBrightness.value = .95 * (1 - .65 * n);
    this.stars.visible = n > .005; this.stars.material.opacity = n * .45;
    this.fireflies.visible = active && n > .005 && !this.owner.selected; this.fireflies.material.opacity = n * .82;
    const positions = this.fireflies.geometry.attributes.position;
    if (active && n > .005) {
      for (let i = 0; i < this.fireflies.geometry.drawRange.count; i++) {
        const rest = this.flyRest[i], phase = i * 2.39996;
        positions.setXYZ(i, rest.x + Math.sin(t * .23 + phase) * 1.1, rest.y + Math.sin(t * .28 + phase) * .45, rest.z + Math.cos(t * .19 + phase) * .9);
      }
      positions.needsUpdate = true;
    }
    this.petals.visible = active && n < .5 && !this.owner.selected;
    if (this.petals.visible) for (const [i, petal] of this.petals.children.entries()) {
      const rest = petal.userData.rest, y = 1 + ((rest.y - 1 - t * .15) % 18 + 18) % 18;
      petal.position.set(rest.x + Math.sin(t * .19 + i) * .28, y, rest.z);
      petal.rotation.z = i * .4 + t * .06;
      // Invisible while crossing the top/bottom boundary; no visible respawn jump.
      petal.material.opacity = .36 * Math.min(1, (y - 1) / 1.5, (19 - y) / 1.5);
    }
    this.leafUniforms.time.value = t; this.leafUniforms.motion.value = active ? 1 : 0;
    this.pathLights.visible = n > .5;
    const shimmer = active ? .5 + .5 * Math.sin(t * .65) : .5;
    if (this.owner.loveDetails?.branchLights) this.owner.loveDetails.branchLights.material.emissiveIntensity = .7 + n * 1.1;
    const nightLamps = this.owner.trunkKeepsakes?.getObjectByName('trunk-night-lamps');
    if (nightLamps) {
      nightLamps.userData.glassMaterial.emissiveIntensity = .65 + n * .7;
      nightLamps.userData.glowMaterial.opacity = .4 + n * .45;
    }
    for (const material of [this.owner.threadHearts?.material, this.owner.trunkKeepsakes?.getObjectByName('trunk-love-hearts')?.material]) if (material) {
      material.emissiveIntensity = .055 + n * (.34 + shimmer * .15);
    }
    if (this.heartSparkles) this.heartSparkles.material.opacity = .46 + n * .42;
    if (active && this.pulseAge < 1.2) this.pulseAge += step;
    this.halo.visible = active && this.pulseAge < 1.2;
    this.halo.material.opacity = this.halo.visible ? Math.sin(this.pulseAge / 1.2 * Math.PI) * .09 : 0;
    this.halo.scale.setScalar(1 + Math.min(this.pulseAge, 1.2) * .3);
    let ambientHighlights = 0;
    for (const card of this.owner.cards) {
      const ambient = !this.owner.hovered && !this.owner.selected && !this.owner.focusStory && ambientHighlights < 5 && card.photo.indexInStory === 0 && (this.owner.year === null || card.photo.year === this.owner.year);
      if (ambient) ambientHighlights++;
      const important = ambient || card.photo === this.owner.hovered || card.photo === this.owner.selected || (this.owner.focusStory && card.photo.story === this.owner.focusStory && card.photo.indexInStory === 0);
      card.plate.material.emissiveIntensity = .96 - n * .12 + (important && active ? n * (.11 + Math.sin(t * .85) * .055) : 0);
    }
  }
}

import * as THREE from 'three';
import { createEnvelopeModel, disposeEnvelopeObject } from './envelope-model.js';

// Original geometry/choreography, visually informed by Teacher-s-Day-Wishes.
// No upstream code, audio, fonts or model assets are copied.
export function createEnvelopeReader(canvas, { onRead = () => {}, onPhase = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.setClearColor(0, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
  scene.add(new THREE.HemisphereLight('#fff0dc', '#b798a2', 1.7));
  const light = new THREE.DirectionalLight('#fff0dc', 1.9); light.position.set(-3, 4, 6); scene.add(light);
  const root = new THREE.Group(); scene.add(root);
  const model = createEnvelopeModel(); root.add(model.group);
  const paperBack = new THREE.MeshStandardMaterial({ color: '#fff3d9', roughness: 1, side: THREE.BackSide, emissive: '#fff3d9', emissiveIntensity: .16 });
  function paperPanel(width, height) {
    const image = document.createElement('canvas'); image.width = 1024; image.height = 384;
    const map = new THREE.CanvasTexture(image); map.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Group(), geometry = new THREE.PlaneGeometry(width, height);
    panel.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map, toneMapped: false })));
    const back = new THREE.Mesh(geometry, paperBack); back.position.z = -.008; panel.add(back);
    return { panel, image, map };
  }
  const sheet = new THREE.Group(); root.add(sheet);
  const lower = paperPanel(3.12, 1.1); sheet.add(lower.panel);
  const hinge = new THREE.Group(); hinge.position.set(0, .55, -.015); sheet.add(hinge);
  const upper = paperPanel(3.12, 1.1); upper.panel.position.y = .55; hinge.add(upper.panel);
  const brokenSeal = new THREE.Group(); brokenSeal.position.copy(model.seal.position); model.group.add(brokenSeal);
  const wax = new THREE.MeshStandardMaterial({ color: '#d87b95', roughness: .62, emissive: '#c87992', emissiveIntensity: .25, transparent: true });
  for (let i = 0; i < 6; i++) {
    const shape = new THREE.Shape(), start = i * Math.PI / 3 + .025, end = (i + 1) * Math.PI / 3 - .025;
    shape.moveTo(0, 0); shape.lineTo(Math.cos(start) * .3, Math.sin(start) * .3); shape.absarc(0, 0, .3, start, end, false); shape.closePath();
    brokenSeal.add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 1, curveSegments: 8 }), wax));
  }
  // A single instanced draw sends small hearts toward the viewer over the real tree.
  const heart = new THREE.Shape(); heart.moveTo(0, .2);
  heart.bezierCurveTo(-.45, .8, -1, .3, -.65, -.2);
  heart.bezierCurveTo(-.4, -.55, -.12, -.7, 0, -.85);
  heart.bezierCurveTo(.12, -.7, .4, -.55, .65, -.2);
  heart.bezierCurveTo(1, .3, .45, .8, 0, .2);
  const seeds = Array.from({ length: innerWidth <= 760 ? 48 : 80 }, (_, i) => ({ x: ((i * .618034 + .13) % 1) * 2 - 1, y: ((i * .414214 + .21) % 1) * 2 - 1, depth: (i * .754878) % 1, size: .09 + i % 5 * .024 }));
  const hearts = new THREE.InstancedMesh(new THREE.ShapeGeometry(heart, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: .78, depthWrite: false, toneMapped: false }), seeds.length);
  const heartPose = new THREE.Object3D(), tint = new THREE.Color();
  seeds.forEach((seed, i) => hearts.setColorAt(i, tint.set(['#df91ac', '#f4b6c8', '#fff0db', '#ce7395'][i % 4])));
  hearts.instanceMatrix.setUsage(THREE.DynamicDrawUsage); hearts.frustumCulled = false; scene.add(hearts);
  let frame = 0, started = null, opened = false, disposed = false, currentT = 0, currentClock = 0, phase = '';
  const created = performance.now();
  const ease = (t, start, duration) => { const v = THREE.MathUtils.clamp((t - start) / duration, 0, 1); return v * v * (3 - 2 * v); };
  function pose(t, clock) {
    const wake = ease(t, 0, .6), release = ease(t, .55, 1.2), flap = ease(t, .75, 1.25), rise = ease(t, 1.6, 1.6), fold = ease(t, 2.85, 1.25), leave = ease(t, 3.2, 2), turn = ease(t, 4.2, 1.4), land = ease(t, 5.4, 1.1);
    model.seal.visible = release === 0; model.seal.scale.setScalar(1.25 + Math.sin(wake * Math.PI) * .09);
    model.seal.children[0].material.emissiveIntensity = .12 + wake * .4;
    brokenSeal.visible = release > 0 && release < 1; wax.opacity = 1 - release;
    brokenSeal.children.forEach((piece, i) => {
      const angle = (i + .5) * Math.PI / 3;
      piece.position.set(Math.cos(angle) * release * .85, Math.sin(angle) * release * .65 - release * release * .45, release * (.3 + i % 2 * .12));
      piece.rotation.set(release * (i % 2 ? 1.3 : -.9), release * .7, release * (i - 2.5) * .35);
    });
    model.flap.rotation.x = -Math.PI * flap; model.flap.position.z = .075 - flap * .17;
    model.group.position.y = -leave * 4.5; model.group.rotation.x = -leave * .42; model.group.visible = leave < 1;
    sheet.position.set(0, -.15 + rise * 3.3 + Math.sin(clock * .8) * .018 * land, -.012 + leave * .2);
    hinge.rotation.x = -Math.PI * (1 - fold);
    sheet.rotation.set(0, turn * Math.PI * 2, Math.sin(turn * Math.PI) * .055 + Math.sin(clock * .6) * .008 * land);
    root.rotation.set(.025 * (1 - rise), -.13 * (1 - rise), -.02 * (1 - rise));
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), home = Math.max(10.2, 2.35 / (tan * camera.aspect)), end = Math.max(7.5, 2 / (tan * camera.aspect));
    const dolly = ease(t, 3.35, 2.5), look = .3 + rise * 3.4;
    camera.position.set(0, look, THREE.MathUtils.lerp(home, end, dolly)); camera.lookAt(0, look, 0); camera.updateMatrixWorld();
    const halfH = 13 * tan, halfW = halfH * camera.aspect;
    seeds.forEach((seed, i) => {
      const progress = (seed.depth + clock * .23) % 1, distance = 18 - progress * 17;
      heartPose.position.set((seed.x + Math.sin(clock * .5 + i) * .025) * halfW, look + seed.y * halfH, camera.position.z - distance);
      heartPose.rotation.set(Math.sin(clock + i) * .15, Math.sin(clock * .6 + i) * .35, Math.sin(clock * .4 + i) * .3);
      heartPose.scale.setScalar(seed.size * Math.min(1, progress * 8, (1 - progress) * 12));
      heartPose.updateMatrix(); hearts.setMatrixAt(i, heartPose.matrix);
    });
    hearts.instanceMatrix.needsUpdate = true;
    const next = !opened ? 'sealed' : t < .75 ? 'seal' : t < 1.6 ? 'flap' : t < 2.85 ? 'rise' : t < 4.2 ? 'unfold' : t < 5.6 ? 'turn' : 'settle';
    if (next !== phase) { phase = next; onPhase(next); }
  }
  function resize() {
    if (disposed) return;
    const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); pose(currentT, currentClock); renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  function draw(now) {
    if (disposed) return;
    currentT = started === null ? 0 : (now - started) / 1000; currentClock = (now - created) / 1000;
    pose(currentT, currentClock); renderer.render(scene, camera);
    if (opened && currentT >= 6.5) { frame = 0; onRead(); return; }
    frame = requestAnimationFrame(draw);
  }
  function writePaper(part, letter, top) {
    const ctx = part.image.getContext('2d'); ctx.fillStyle = '#fff5df'; ctx.fillRect(0, 0, 1024, 384);
    ctx.strokeStyle = '#d7b581'; ctx.lineWidth = 2; ctx.strokeRect(24, 18, 976, 348);
    ctx.strokeStyle = '#c1a17d18'; ctx.lineWidth = 1;
    for (let y = 56; y < 350; y += 36) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(984, y); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.fillStyle = '#ac617b';
    if (top) {
      ctx.font = '25px Georgia, serif'; ctx.fillText('WITH ALL MY LOVE', 512, 80);
      ctx.font = '56px SimSun, serif'; ctx.fillText(letter.title, 512, 200, 880);
      ctx.font = '52px Georgia, serif'; ctx.fillText('♡', 512, 310);
    } else {
      ctx.font = '40px SimSun, serif'; ctx.fillText(letter.recipient, 512, 100, 880);
      ctx.fillStyle = '#9e7865'; ctx.font = '29px SimSun, serif'; ctx.fillText(letter.body.split('\n').find(line => line.trim())?.slice(0, 40) || '', 512, 194, 880);
      ctx.font = '25px SimSun, serif'; ctx.fillText(`${letter.signature} · ${letter.date}`, 512, 302, 880);
    }
    part.map.needsUpdate = true;
  }
  return {
    open(letter) { writePaper(upper, letter, true); writePaper(lower, letter, false); resize(); frame = requestAnimationFrame(draw); },
    unseal() { if (opened || disposed) return; opened = true; started = performance.now(); },
    dispose() { if (disposed) return; disposed = true; cancelAnimationFrame(frame); observer.disconnect(); disposeEnvelopeObject(scene); renderer.dispose(); renderer.forceContextLoss(); }
  };
}

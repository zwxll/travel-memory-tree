import * as THREE from 'three';
import { Grass } from '../umbrella-canopy/vendor/garden/meadow/src/grass/Grass.ts';
import { enrichFlowers } from '../umbrella-canopy/js/flowers.js';

// Same licensed meadow components, planted up to the heart-shaped pebble border.
export function buildTreeGarden(scene, reducedMotion) {
  const phone = innerWidth <= 760;
  const surface = new THREE.Mesh(new THREE.CircleGeometry(16.8, 96).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#91a67c', transparent: true }));
  surface.material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec2 vGardenXZ;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGardenXZ=transformed.xz;');
    shader.fragmentShader = 'varying vec2 vGardenXZ;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a*=1.0-smoothstep(15.12,16.8,length(vGardenXZ));');
  };
  const planted = ({ position: p }) => {
    const r = Math.hypot(p.x, p.z), nx = p.x / 5.55, ny = -p.z / 5.25;
    const insidePaving = (nx * nx + ny * ny - 1) ** 3 - nx * nx * ny ** 3 <= 0;
    return !insidePaving && r > 1.6 && r < 16.2 ? 1 - THREE.MathUtils.smoothstep(r, 15.12, 16.2) : 0;
  };
  const meadow = new Grass({ surface, coverage: { sample: planted },
    grass: { density: phone ? 4 : 12, shadow: false, brightness: .95,
      blade: { minHeight: .12, maxHeight: .34, minWidth: .025, maxWidth: .06, segments: 2 },
      colors: { bottom: '#536940', top: '#a6b882', backlight: '#fff0b5' },
      wind: { strength: reducedMotion ? 0 : .12, speed: .5, turbulence: .1 }, lighting: { intensity: .9, color: '#fff4df', backlightStrength: .25 } },
    wildflowers: { density: 25, maxCount: phone ? 1000 : 5000, coverage: { sample: point => planted(point) * (.5 + .5 * Math.sin(point.position.x * 1.6) ** 2) } }
  });
  enrichFlowers(meadow.wildflowers); scene.add(meadow);
  const flowerRing = new THREE.Group(); flowerRing.name = 'garden-flower-ring';
  const flowerCount = phone ? 80 : 144; flowerRing.userData.flowerCount = flowerCount;
  const petalGeometry = new THREE.SphereGeometry(1, 10, 6), petalPositions = petalGeometry.attributes.position;
  for (let i = 0; i < petalPositions.count; i++) {
    const x = petalPositions.getX(i), y = petalPositions.getY(i), z = petalPositions.getZ(i), tip = (z + 1) / 2;
    petalPositions.setXYZ(i, x * (.72 + .28 * tip), y * .22 + .22 * tip * tip, z);
  }
  petalGeometry.computeVertexNormals();
  const petals = new THREE.InstancedMesh(petalGeometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .76 }), flowerCount * 15);
  const centers = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), new THREE.MeshStandardMaterial({ color: '#d6ab58', roughness: .86 }), flowerCount);
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6, 1), new THREE.MeshLambertMaterial({ color: '#69805a' }), flowerCount);
  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 4), new THREE.MeshLambertMaterial({ color: '#809467' }), flowerCount * 2);
  petals.name = 'garden-flower-petals'; centers.name = 'garden-flower-centers';
  stems.name = 'garden-flower-stems'; leaves.name = 'garden-flower-leaves';
  const flower = new THREE.Object3D(), part = new THREE.Object3D(), matrix = new THREE.Matrix4(), color = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3(), bottom = new THREE.Vector3();
  const palette = ['#e6a3b9', '#efb8c9', '#f6dce4', '#fff1d7', '#fff9ef', '#d8c8e9'];
  let flowerSeed = 671029;
  const random = () => { flowerSeed = (Math.imul(flowerSeed, 1664525) + 1013904223) >>> 0; return flowerSeed / 4294967296; };
  for (let i = 0; i < flowerCount; i++) {
    const angle = (i + .45 * (random() - .5)) * Math.PI * 2 / flowerCount;
    const radius = 10.9 + 4.3 * ((i * .61803398875 + random() * .15) % 1) + .18 * Math.sin(angle * 3);
    const size = .74 + .48 * random(), height = .48 + .54 * random(), tint = random();
    const base = new THREE.Color(palette[tint < .4 ? i % 2 : tint < .7 ? 2 : tint < .92 ? 3 + i % 2 : 5]);
    flower.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    flower.rotation.set((random() - .5) * .3, random() * Math.PI * 2, (random() - .5) * .3); flower.updateMatrix();
    for (let layer = 0; layer < 2; layer++) {
      const count = layer ? 6 : 9;
      for (let petal = 0; petal < count; petal++) {
        const a = petal * Math.PI * 2 / count + layer * .4, r = (layer ? .13 : .25) * size;
        part.position.set(Math.sin(a) * r, layer * .1 * size, Math.cos(a) * r);
        part.rotation.set((random() - .5) * .18, a, 0);
        part.scale.set((layer ? .15 : .21) * size, (layer ? .55 : .5) * size, (layer ? .24 : .35) * size); part.updateMatrix();
        const index = i * 15 + (layer ? 9 : 0) + petal;
        petals.setMatrixAt(index, matrix.multiplyMatrices(flower.matrix, part.matrix));
        petals.setColorAt(index, color.copy(base).offsetHSL(0, layer ? .025 : 0, layer ? -.04 : (random() - .5) * .025));
      }
    }
    part.position.set(0, .19 * size, 0); part.rotation.set(0, 0, 0); part.scale.set(.11 * size, .065 * size, .11 * size); part.updateMatrix();
    centers.setMatrixAt(i, matrix.multiplyMatrices(flower.matrix, part.matrix));
    bottom.set(flower.position.x - .1 * Math.sin(angle), .025, flower.position.z - .1 * Math.cos(angle));
    direction.subVectors(flower.position, bottom);
    part.position.copy(bottom).addScaledVector(direction, .5);
    part.quaternion.setFromUnitVectors(up, direction.clone().normalize()); part.scale.set(.016 * size, direction.length(), .016 * size); part.updateMatrix();
    stems.setMatrixAt(i, part.matrix);
    for (let leaf = 0; leaf < 2; leaf++) {
      const a = angle + leaf * Math.PI + .7;
      part.position.copy(bottom).addScaledVector(direction, .3 + leaf * .23);
      part.position.x += Math.sin(a) * .12 * size; part.position.z += Math.cos(a) * .12 * size;
      part.rotation.set(-.35, a, .1); part.scale.set(.085 * size, .018 * size, .23 * size); part.updateMatrix();
      leaves.setMatrixAt(i * 2 + leaf, part.matrix);
    }
  }
  for (const mesh of [petals, centers, stems, leaves]) { mesh.computeBoundingBox(); mesh.computeBoundingSphere(); flowerRing.add(mesh); }
  scene.add(flowerRing);
  // Rounded pastel river pebbles form a filled heart, leaving the trunk base clear.
  const stonePositions = [], centerPositions = [], step = phone ? .5 : .38;
  for (let z = -6.6; z <= 5.3; z += step) for (let x = -6.3; x <= 6.3; x += step) {
    const nx = x / 5.3, ny = -z / 5;
    if ((nx * nx + ny * ny - 1) ** 3 - nx * nx * ny ** 3 > 0) continue;
    const positions = Math.hypot(x, z) < 1.48 ? centerPositions : stonePositions;
    positions.push([x + (random() - .5) * .08, z + (random() - .5) * .08]);
  }
  const surroundingStoneCount = stonePositions.length;
  stonePositions.push(...centerPositions);
  const stoneGeometry = new THREE.SphereGeometry(1, 10, 7), stoneVertices = stoneGeometry.attributes.position;
  for (let i = 0; i < stoneVertices.count; i++) {
    const x = stoneVertices.getX(i), y = stoneVertices.getY(i), z = stoneVertices.getZ(i);
    const radius = 1 + .045 * Math.sin(x * 5 + z * 3) * Math.cos(y * 4);
    stoneVertices.setXYZ(i, x * radius, y * radius, z * radius);
  }
  stoneGeometry.computeVertexNormals();
  const pebbles = new THREE.InstancedMesh(stoneGeometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .64, metalness: .04 }), stonePositions.length);
  pebbles.name = 'heart-pebble-paving';
  const stoneColors = ['#d9c8ba', '#e8dbca', '#c1b6b2', '#d8bbc3', '#b7c4bc', '#c4bed0'];
  for (const [i, [x, z]] of stonePositions.entries()) {
    const height = .1 + random() * .065;
    part.position.set(x, height * .82, z); part.rotation.set((random() - .5) * .2, random() * Math.PI * 2, (random() - .5) * .18);
    part.scale.set(step * (.47 + random() * .1), height, step * (.44 + random() * .11)); part.updateMatrix();
    pebbles.setMatrixAt(i, part.matrix); pebbles.setColorAt(i, color.set(stoneColors[i % stoneColors.length]).offsetHSL(0, 0, (random() - .5) * .035));
  }
  pebbles.computeBoundingBox(); pebbles.computeBoundingSphere(); scene.add(pebbles);
  pebbles.count = surroundingStoneCount;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(130, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor: { value: new THREE.Color('#aecada') }, horizonColor: { value: new THREE.Color('#fae6c7') } },
    vertexShader: 'varying float vHeight;void main(){vHeight=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 topColor;uniform vec3 horizonColor;varying float vHeight;void main(){gl_FragColor=vec4(mix(horizonColor,topColor,smoothstep(-.05,.65,vHeight)),1.0);\n#include <colorspace_fragment>\n}'
  }));
  scene.add(sky);
  let motionEnabled = !reducedMotion, motionTime = 0, previousTime = 0;
  return { meadow, flowerRing, pebbles,
    setHeartMode(enabled) { pebbles.count = enabled ? stonePositions.length : surroundingStoneCount; },
    setMotionEnabled(enabled) { motionEnabled = enabled; },
    update(time) {
      if (motionEnabled) motionTime += Math.max(0, Math.min(.1, time - previousTime));
      previousTime = time; meadow.update(motionTime);
    }
  };
}

import * as THREE from 'three';
import { generateRibbonGeometryClass } from './vendor/ribbon-geometry/RibbonGeometry.ts';

const RibbonGeometry = generateRibbonGeometryClass({ THREE: {
  BufferGeometry: THREE.BufferGeometry, Float32BufferAttribute: THREE.Float32BufferAttribute,
  Quaternion: THREE.Quaternion, Vector2: THREE.Vector2, Vector3: THREE.Vector3,
} });

// Decorative objects only: never enter the photo/city picking list.
export function addLoveDetails(tree, scene, garden) {
  const canopy = new THREE.Group(); canopy.name = 'canopy-love-details'; tree.add(canopy);
  const ribs = tree.getObjectByName('tree-canopy-ribs').geometry.attributes.position;
  const point = new THREE.Vector3();
  // The first tube in each of the 24 rib sectors has 21 rings of 11 vertices.
  const branchPoint = (sector, ring = 20) => {
    const center = new THREE.Vector3();
    for (let j = 0; j < 10; j++) center.add(point.fromBufferAttribute(ribs, sector * 693 + ring * 11 + j));
    return center.multiplyScalar(.1).add(new THREE.Vector3(0, .15, 0));
  };
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const cream = new THREE.MeshStandardMaterial({ color: '#f3e8d5', roughness: .92 });
  const blush = new THREE.MeshStandardMaterial({ color: '#d1afa3', roughness: .94 });
  const feather = new THREE.MeshStandardMaterial({ color: '#c6b19a', roughness: .96 });
  const dark = new THREE.MeshStandardMaterial({ color: '#463c34', roughness: .68 });
  const beak = new THREE.MeshStandardMaterial({ color: '#bb9270', roughness: .8 });
  const ellipsoid = (parent, material, position, scale) => {
    const mesh = new THREE.Mesh(sphere, material); mesh.position.set(...position); mesh.scale.set(...scale); parent.add(mesh); return mesh;
  };
  const lightGroup = new THREE.Group(); lightGroup.name = 'branch-love-lights'; canopy.add(lightGroup);
  const lightSectors = [0, 3, 5, 9, 11, 14, 19, 22], bulbsPerBranch = innerWidth <= 760 ? 18 : 30;
  const trunkBulbs = scene.getObjectByName('trunk-love-lights');
  const branchLights = new THREE.InstancedMesh(trunkBulbs.geometry, trunkBulbs.material.clone(), lightSectors.length * bulbsPerBranch);
  branchLights.name = 'branch-love-light-bulbs';
  const lightPose = new THREE.Matrix4(), lightColor = new THREE.Color();
  const wireMaterial = new THREE.MeshStandardMaterial({ color: '#755737', roughness: .7, metalness: .25 });
  lightSectors.forEach((sector, index) => {
    const centers = Array.from({ length: 18 }, (_, ring) => branchPoint(sector, ring + 2).add(new THREE.Vector3(0, -.15, 0)));
    const axis = new THREE.CatmullRomCurve3(centers), frames = axis.computeFrenetFrames(160, false);
    const points = Array.from({ length: 161 }, (_, j) => {
      const angle = j / 160 * Math.PI * 8 + index * .7;
      return axis.getPointAt(j / 160).addScaledVector(frames.normals[j], Math.cos(angle) * .176)
        .addScaledVector(frames.binormals[j], Math.sin(angle) * .176);
    });
    const winding = new THREE.CatmullRomCurve3(points);
    const wire = new THREE.Mesh(new THREE.TubeGeometry(winding, 128, .012, 5, false), wireMaterial);
    wire.name = 'branch-love-light-wire-' + sector; lightGroup.add(wire);
    for (let j = 0; j < bulbsPerBranch; j++) {
      const p = winding.getPointAt(j / (bulbsPerBranch - 1)), bulb = index * bulbsPerBranch + j;
      branchLights.setMatrixAt(bulb, lightPose.makeTranslation(p.x, p.y, p.z));
      branchLights.setColorAt(bulb, lightColor.set(['#fff0c2', '#ffe0c0', '#ffc7d8'][j % 3]));
    }
  });
  branchLights.computeBoundingBox(); branchLights.computeBoundingSphere(); lightGroup.add(branchLights);
  const eyeShine = new THREE.MeshBasicMaterial({ color: '#fff7e6' });
  // Taper the folded wings toward their tips, rather than using round paddles.
  const wingGeometry = sphere.clone(), wingVertices = wingGeometry.attributes.position;
  for (let j = 0; j < wingVertices.count; j++) {
    const z = wingVertices.getZ(j), taper = .62 + .38 * (z + 1) / 2;
    wingVertices.setXYZ(j, wingVertices.getX(j) * taper, wingVertices.getY(j) * taper, z);
  }
  wingGeometry.computeVertexNormals();
  const pair = new THREE.Group(); pair.name = 'companion-birds'; canopy.add(pair);
  const branch = tree.getObjectByName('tree-canopy-ribs'); tree.updateWorldMatrix(true, true);
  // Small independent perch twigs reach beyond the leaf rim; original branches stay intact.
  const perches = [2, 10, 18].map((sector, index) => {
    const angle = sector * Math.PI / 12, radial = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle));
    const anchor = branchPoint(sector); anchor.y -= .15;
    const center = anchor.clone().addScaledVector(radial, 2.15); center.y += .08;
    const path = new THREE.CatmullRomCurve3([
      anchor, anchor.clone().addScaledVector(radial, 1.1).addScaledVector(tangent, -.32),
      center.clone().addScaledVector(tangent, -.52), center.clone().addScaledVector(tangent, .52),
    ]);
    const inset = branchPoint(sector, 19); inset.y -= .15;
    const outgoing = path.getPoint(1 / 3), reach = anchor.distanceTo(outgoing) / 3;
    const transition = new THREE.CubicBezierCurve3(anchor,
      anchor.clone().add(anchor.clone().sub(inset).normalize().multiplyScalar(reach)),
      outgoing.clone().addScaledVector(path.getTangent(1 / 3), -reach), outgoing);
    const joined = new THREE.Curve();
    joined.getPoint = (t, target = new THREE.Vector3()) => {
      if (t < .18) return target.copy(inset).lerp(anchor, t / .18);
      const u = (t - .18) / .82;
      return u < 1 / 3 ? transition.getPoint(u * 3, target) : path.getPoint(u, target);
    };
    const geometry = new THREE.TubeGeometry(joined, 64, 1, 10, false), vertices = geometry.attributes.position, uv = geometry.attributes.uv;
    const grainScale = joined.getLength() / 19.5;
    for (let j = 0; j < vertices.count; j++) {
      const t = Math.floor(j / 11) / 64, centerline = joined.getPointAt(t);
      // Overlap inside the original limb, match its cut edge, then taper into the perch.
      const radius = t < .18 ? THREE.MathUtils.lerp(.147, .151, t / .18)
        : THREE.MathUtils.lerp(.151, .045, THREE.MathUtils.smoothstep(t, .18, 1));
      vertices.setXYZ(j, centerline.x + (vertices.getX(j) - centerline.x) * radius,
        centerline.y + (vertices.getY(j) - centerline.y) * radius,
        centerline.z + (vertices.getZ(j) - centerline.z) * radius);
      uv.setXY(j, .95 + uv.getX(j) * grainScale, uv.getY(j) * 1.15);
    }
    geometry.computeVertexNormals();
    const twig = new THREE.Mesh(geometry, branch.material);
    twig.name = 'companion-bird-perch-' + index; pair.add(twig);
    return { path, angle, twig };
  });
  tree.updateWorldMatrix(true, true);
  const perchRay = new THREE.Raycaster(); perchRay.ray.direction.set(0, -1, 0);
  const birds = [];
  for (let index = 0; index < 6; index++) {
    const i = index % 2, perchSite = perches[Math.floor(index / 2)];
    const bird = new THREE.Group(); bird.name = i ? 'blush-companion-bird' : 'cream-companion-bird';
    const side = i ? 1 : -1, angle = perchSite.angle;
    bird.position.copy(perchSite.path.getPoint(i ? .94 : .74));
    // Wings' fixed perch-location approach; only the body/head move, never the feet.
    const perch = tree.localToWorld(bird.position.clone());
    perchRay.ray.origin.copy(perch).add(new THREE.Vector3(0, 1, 0));
    const support = perchRay.intersectObject(perchSite.twig, false)[0];
    if (support) bird.position.copy(tree.worldToLocal(support.point)).y += .002;
    bird.userData.perch = bird.position.toArray(); bird.userData.perchTwig = perchSite.twig;
    bird.scale.y = 1 / tree.scale.y; bird.rotation.y = Math.PI / 2 - angle; pair.add(bird);
    const material = i ? blush : cream;
    const body = new THREE.Group(); body.position.set(0, .4, .035); body.rotation.z = side * .055; body.rotation.y = -side * .4; bird.add(body);
    const plumage = sphere.clone(), colors = [];
    const baseColor = material.color, softBreast = new THREE.Color(i ? '#eed8c9' : '#fff4df');
    for (let j = 0; j < plumage.attributes.position.count; j++) {
      const front = THREE.MathUtils.smoothstep(plumage.attributes.position.getZ(j), -.1, .85);
      const color = baseColor.clone().lerp(softBreast, front * .85); colors.push(color.r, color.g, color.b);
    }
    plumage.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const plumageMaterial = material.clone(); plumageMaterial.color.set('#ffffff'); plumageMaterial.vertexColors = true;
    const torso = new THREE.Mesh(plumage, plumageMaterial); torso.scale.set(.245, .255, .47); torso.rotation.x = .25; body.add(torso);
    const wingMaterial = i ? feather : cream;
    for (const flank of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeometry, wingMaterial); wing.name = 'folded-wing';
      wing.position.set(flank * .21, .025, -.13); wing.scale.set(.055, .14, .35); wing.rotation.x = -.3; body.add(wing);
    }
    // Layered flight feathers share one instanced draw per bird.
    const feathers = new THREE.InstancedMesh(wingGeometry, wingMaterial, 8), featherPose = new THREE.Object3D();
    feathers.name = 'layered-wing-feathers';
    for (let f = 0; f < 8; f++) {
      const flank = f < 4 ? -1 : 1, row = f % 4;
      featherPose.position.set(flank * (.23 + row * .001), -.045 - row * .025, -.23 - row * .04);
      featherPose.rotation.set(-.32, flank * .1, 0); featherPose.scale.set(.018, .044, .18 - row * .012);
      featherPose.updateMatrix(); feathers.setMatrixAt(f, featherPose.matrix);
    }
    body.add(feathers);
    const tails = new THREE.InstancedMesh(wingGeometry, wingMaterial, 3); tails.name = 'tapered-tail-feathers';
    for (let f = 0; f < 3; f++) {
      featherPose.position.set((f - 1) * .07, -.12, -.49); featherPose.rotation.set(-.28, (f - 1) * .12, 0);
      featherPose.scale.set(.06, .033, .27 - Math.abs(f - 1) * .025); featherPose.updateMatrix(); tails.setMatrixAt(f, featherPose.matrix);
    }
    body.add(tails);
    const head = new THREE.Group(); head.position.set(-side * .025, .17, .32); head.rotation.z = side * .15; body.add(head);
    ellipsoid(head, material, [0, 0, 0], [.155, .16, .18]);
    const bill = new THREE.Mesh(new THREE.ConeGeometry(.036, .16, 8), beak); bill.rotation.x = Math.PI / 2; bill.scale.z = .7; bill.position.set(0, -.03, .233); head.add(bill);
    const eyes = [-1, 1].map(flank => {
      const eye = ellipsoid(head, dark, [flank * .126, .024, .109], [.017, .019, .014]);
      ellipsoid(eye, eyeShine, [flank * .2, .24, .8], [.22, .22, .22]);
      return eye;
    });
    const toes = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.009, .08, 2, 4), beak, 6);
    for (let foot = 0; foot < 2; foot++) {
      const x = foot ? .065 : -.065;
      const start = new THREE.Vector3(x, .018, .01), end = new THREE.Vector3(x, .17, .035), direction = end.clone().sub(start);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.01, .013, direction.length(), 5), beak);
      leg.position.copy(start).addScaledVector(direction, .5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()); bird.add(leg);
      for (let toe = 0; toe < 3; toe++) {
        featherPose.position.set(x + (toe - 1) * .019, .009, .035); featherPose.rotation.set(Math.PI / 2, 0, (toe - 1) * .32);
        featherPose.scale.setScalar(1); featherPose.updateMatrix(); toes.setMatrixAt(foot * 3 + toe, featherPose.matrix);
      }
    }
    bird.add(toes);
    birds.push({ bird, body, head, eyes });
  }
  const ribbonGroup = new THREE.Group(); ribbonGroup.name = 'branch-love-ribbons'; ribbonGroup.visible = false; canopy.add(ribbonGroup);
  const ribbons = [];
  const wind = { time: { value: 0 }, enabled: { value: 0 } };
  const clothColors = ['#e8b9c5', '#f2e5cc', '#e8d1b1'];
  const ribbonStrip = (path, width, material) => {
    const curve = new THREE.CatmullRomCurve3(path.map(p => new THREE.Vector3(...p)));
    const geometry = new RibbonGeometry(curve, 24, width, .08);
    geometry.computeBoundingSphere(); geometry.boundingSphere.radius += .07;
    return new THREE.Mesh(geometry, material);
  };
  [1, 7, 11, 16, 21].forEach((sector, i) => {
    const pivot = new THREE.Group(); pivot.name = `branch-love-ribbon-${i}`;
    pivot.position.copy(branchPoint(sector)); pivot.rotation.y = Math.PI / 2 - sector * Math.PI / 12;
    const length = [1.45, 2.05, 1.65, 2.25, 1.8][i];
    const material = new THREE.MeshStandardMaterial({ color: clothColors[i % 3], roughness: .94, metalness: 0, side: THREE.DoubleSide });
    const cloth = material.clone();
    cloth.onBeforeCompile = shader => {
      shader.uniforms.uLoveWindTime = wind.time; shader.uniforms.uLoveWindEnabled = wind.enabled;
      shader.uniforms.uLoveWindPhase = { value: i * 1.3 };
      shader.vertexShader = 'uniform float uLoveWindTime, uLoveWindEnabled, uLoveWindPhase;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float clothWeight = uv.y * uv.y * uLoveWindEnabled;
        transformed.x += sin(uLoveWindTime * .38 + uv.y * 2.4 + uLoveWindPhase) * .035 * clothWeight;
        transformed.z += sin(uLoveWindTime * .29 + uv.y * 3.1 + uLoveWindPhase) * .025 * clothWeight;`);
    };
    pivot.add(ribbonStrip([[0, 0, 0], [.1, -length * .24, .14], [-.12, -length * .65, .28], [.07, -length, .4]], .14, cloth));
    ellipsoid(pivot, material, [0, .015, 0], [.07, .055, .06]);
    if (i === 0 || i === 3) for (const side of [-1, 1]) {
      pivot.add(ribbonStrip([[0, .015, 0], [side * .2, .18, .04], [side * .36, .12, .07], [side * .25, -.05, .09], [0, .015, 0]], .075, material));
    }
    ribbonGroup.add(pivot); ribbons.push(pivot);
  });

  const letterGroup = new THREE.Group(); letterGroup.name = 'branch-love-letters'; canopy.add(letterGroup);
  const paper = document.createElement('canvas'); paper.width = 192; paper.height = 128;
  const ink = paper.getContext('2d'); ink.fillStyle = '#f9eed9'; ink.fillRect(0, 0, 192, 128);
  for (let i = 0; i < 650; i++) { ink.fillStyle = i % 2 ? '#b69a7510' : '#ffffff58'; ink.fillRect(i * 73 % 192, i * 47 % 128, 1, 1); }
  ink.strokeStyle = '#b9a58a'; ink.lineWidth = .8;
  ink.beginPath(); ink.moveTo(3, 4); ink.lineTo(96, 69); ink.lineTo(189, 4); ink.moveTo(3, 125); ink.lineTo(70, 63); ink.moveTo(189, 125); ink.lineTo(122, 63); ink.stroke();
  const paperMap = new THREE.CanvasTexture(paper); paperMap.colorSpace = THREE.SRGBColorSpace;
  const paperMaterial = new THREE.MeshStandardMaterial({ map: paperMap, roughness: .98, emissive: '#f6ead6', emissiveIntensity: .12 });
  const paperGeometry = new THREE.BoxGeometry(.62, .43, .025);
  // A closed paper cover, inspired by medina's separate Envelope/Cover layers.
  // Rebuilt as static geometry: no skeleton, opening animation or pointer handlers.
  const flapGeometry = new THREE.BufferGeometry();
  flapGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-.305, .205, .019, .305, .205, .019, 0, -.02, .028], 3));
  flapGeometry.setIndex([0, 2, 1]); flapGeometry.computeVertexNormals();
  const flapMaterial = new THREE.MeshStandardMaterial({ color: '#f4e7d3', roughness: .98, side: THREE.DoubleSide, emissive: '#f6ead6', emissiveIntensity: .12 });
  const foldGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.305, .205, .02), new THREE.Vector3(0, -.02, .029), new THREE.Vector3(.305, .205, .02)]);
  const foldMaterial = new THREE.LineBasicMaterial({ color: '#c6b398' });
  const thread = new THREE.MeshStandardMaterial({ color: '#c7a7a4', roughness: 1 });
  const wax = new THREE.MeshStandardMaterial({ color: '#b57b89', roughness: .78 });
  const sealGeometry = new THREE.CylinderGeometry(.047, .052, .014, 12);
  const letters = [];
  [0, 5, 13, 19].forEach((sector, i) => {
    const pivot = new THREE.Group(); pivot.name = `branch-love-letter-${i}`;
    pivot.position.copy(branchPoint(sector)); pivot.rotation.y = Math.PI / 2 - sector * Math.PI / 12;
    const length = .65 + i % 3 * .17;
    const cord = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(.035, -length * .5, .16), new THREE.Vector3(0, -length, .3)]);
    pivot.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 12, .008, 5, false), thread));
    const envelope = new THREE.Mesh(paperGeometry, paperMaterial); envelope.name = 'keepsake-envelope'; envelope.position.set(0, -length - .215, .3); envelope.rotation.z = (i % 2 ? 1 : -1) * .055;
    const cover = new THREE.Mesh(flapGeometry, flapMaterial); cover.name = 'closed-letter-cover'; envelope.add(cover);
    envelope.add(new THREE.Line(foldGeometry, foldMaterial));
    if (i % 2 === 0) {
      const seal = new THREE.Mesh(sealGeometry, wax); seal.name = 'rose-wax-seal'; seal.rotation.x = Math.PI / 2; seal.position.set(0, -.005, .039); envelope.add(seal);
    }
    pivot.add(envelope); letterGroup.add(pivot); letters.push(pivot);
  });

  // Scatter a thin petal outline on the existing paving; keep its middle open.
  const petalCount = innerWidth <= 760 ? 96 : 144;
  const petalGeometry = new THREE.SphereGeometry(1, 8, 5), vertices = petalGeometry.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i);
    vertices.setXYZ(i, x * .55, y * .055 + .06 * (z + 1) ** 2, z * .9);
  }
  petalGeometry.computeVertexNormals();
  const petalHeart = new THREE.InstancedMesh(petalGeometry, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .96, side: THREE.DoubleSide }), petalCount);
  petalHeart.name = 'garden-petal-heart';
  const petal = new THREE.Object3D(), tint = new THREE.Color(), ray = new THREE.Raycaster();
  const surfaceNormal = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), stoneMatrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  ray.ray.direction.set(0, -1, 0); garden.pebbles.updateWorldMatrix(true, false);
  const colors = ['#f0bdc9', '#fff0dc', '#e9a7bb', '#f4d5d9', '#f9e7da'];
  let seed = 82047;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < petalCount; i++) {
    const angle = (i + (random() - .5) * .65) / petalCount * Math.PI * 2;
    const x = 2 * Math.sin(angle) ** 3 + (random() - .5) * .18;
    const z = 2.55 - .125 * (13 * Math.cos(angle) - 5 * Math.cos(2 * angle) - 2 * Math.cos(3 * angle) - Math.cos(4 * angle)) + (random() - .5) * .18;
    ray.ray.origin.set(x, 2, z);
    const surface = ray.intersectObject(garden.pebbles, false)[0];
    surfaceNormal.copy(up);
    if (surface) {
      garden.pebbles.getMatrixAt(surface.instanceId, stoneMatrix); stoneMatrix.premultiply(garden.pebbles.matrixWorld);
      surfaceNormal.copy(surface.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(stoneMatrix));
    }
    petal.position.set(x, surface?.point.y || 0, z).addScaledVector(surfaceNormal, .012);
    petal.quaternion.setFromUnitVectors(up, surfaceNormal); petal.rotateY(random() * Math.PI * 2);
    const size = .105 + random() * .075; petal.scale.set(size, size, size * (.8 + random() * .4)); petal.updateMatrix();
    petalHeart.setMatrixAt(i, petal.matrix); petalHeart.setColorAt(i, tint.set(colors[i % colors.length]));
  }
  petalHeart.computeBoundingBox(); petalHeart.computeBoundingSphere(); scene.add(petalHeart);

  return { canopy, birds, ribbons, letters, petalHeart, wind, branchLights, update(time, enabled) {
    const t = enabled ? time : 0;
    wind.time.value = t; wind.enabled.value = enabled ? 1 : 0;
    birds.forEach(({ body, head, eyes }, i) => {
      body.scale.y = 1 + (enabled ? Math.sin(t * .85 + i * .8) * .004 : 0);
      head.rotation.y = enabled ? Math.sin(t * .22 + i * .9) * .025 : 0;
      const blink = (t + i * .3) % 9.5;
      const open = enabled && blink > 9.2 ? Math.max(.12, Math.abs(blink - 9.35) / .15) : 1;
      eyes.forEach(eye => { eye.scale.y = .019 * open; });
    });
    ribbons.forEach((ribbon, i) => {
      ribbon.rotation.x = enabled ? Math.sin(t * (.32 + i * .025) + i) * .018 : 0;
      ribbon.rotation.z = enabled ? Math.sin(t * .29 + i * 1.1) * .025 : 0;
    });
    letters.forEach((letter, i) => {
      letter.rotation.x = enabled ? Math.sin(t * .34 + i * .9) * .018 : 0;
      letter.rotation.z = enabled ? Math.sin(t * .29 + i * 1.1) * .025 : 0;
    });
  } };
}

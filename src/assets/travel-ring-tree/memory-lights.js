import * as THREE from 'three';

// Camera-facing lights stay beside and behind the tree, leaving the photos clear.
export class TreeMemoryLights extends THREE.Points {
  constructor(tree, map) {
    const bounds = new THREE.Box3().setFromObject(tree), size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z) * .5, positions = [], sizes = [], phases = [], tints = [];
    let seed = 261023;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 36; i++) {
      positions.push((i % 2 ? 1 : -1) * radius * (.66 + random() * .4), bounds.min.y + size.y * (.08 + random() * .62), -radius * (.38 + random() * .18));
      sizes.push(i % 7 === 0 ? 2.8 : 1 + random() * .6); phases.push(random() * Math.PI * 2);
      tints.push(...new THREE.Color(i % 4 === 0 ? '#e8c2ce' : i % 4 === 1 ? '#f7ead8' : '#f2d5a4').toArray());
    }
    const geometry = new THREE.BufferGeometry();
    for (const [name, values, count] of [['position', positions, 3], ['aSize', sizes, 1], ['aPhase', phases, 1], ['aTint', tints, 3]]) geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, count));
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uMap: { value: map }, uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 1 }, uRight: { value: new THREE.Vector3(1, 0, 0) }, uForward: { value: new THREE.Vector3(0, 0, 1) } },
      vertexShader: `attribute float aSize, aPhase; attribute vec3 aTint;
        uniform float uTime, uScale; uniform vec3 uRight, uForward;
        varying vec3 vTint; varying float vAlpha;
        void main() {
          vec3 p = position + vec3(sin(uTime * .16 + aPhase) * .12, cos(uTime * .13 + aPhase) * .16, 0.);
          vec3 world = uRight * p.x + vec3(0., p.y, 0.) + uForward * p.z;
          vec4 view = modelViewMatrix * vec4(world, 1.);
          gl_Position = projectionMatrix * view;
          gl_PointSize = clamp(aSize * uScale / max(-view.z, 1.), 2., 28.);
          vTint = aTint; vAlpha = (aSize > 2. ? .2 : .6) * (.88 + .12 * sin(uTime * .65 + aPhase));
        }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uNight;
        varying vec3 vTint; varying float vAlpha;
        void main() {
          vec4 glow = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(glow.rgb * vTint, glow.a * vAlpha * uNight);
          #include <colorspace_fragment>
        }`,
    });
    super(geometry, material);
    this.name = 'tree-soft-memory-lights'; this.frustumCulled = false; this.visible = false;
    this.onBeforeRender = (renderer, _scene, camera) => {
      const u = material.uniforms, right = u.uRight.value;
      right.setFromMatrixColumn(camera.matrixWorld, 0); right.y = 0; right.normalize();
      u.uForward.value.set(-right.z, 0, right.x); u.uScale.value = renderer.domElement.height * .5;
    };
  }

  update(time, night, lowDensity, selected) {
    this.visible = night > .01 && !selected;
    this.geometry.setDrawRange(0, lowDensity ? 16 : 36);
    this.material.uniforms.uTime.value = time; this.material.uniforms.uNight.value = night;
  }
}

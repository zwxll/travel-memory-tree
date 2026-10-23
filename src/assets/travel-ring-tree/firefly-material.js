import * as THREE from 'three';

// Original Three.js implementation, visually inspired by the React Bits fireflies preset.
export function fireflyMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, opacity: { value: 0 }, pixelHeight: { value: 1000 } },
    vertexShader: `attribute vec3 color; attribute float phase;
      uniform float time, pixelHeight; varying vec3 tint; varying float alpha;
      void main() {
        vec4 p = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * p;
        gl_PointSize = clamp((.35 + .3 * fract(phase * 7.1)) * pixelHeight / max(1., -p.z), 4., 14.);
        tint = color;
        float pulse = .62 + .25 * sin(time * (.65 + fract(phase) * .4) + phase)
          + .1 * sin(time * .37 + phase * 2.3);
        alpha = pulse * smoothstep(2.5, 3.4, position.y) * (1. - smoothstep(16.5, 17.5, position.y));
      }`,
    fragmentShader: `uniform float opacity; varying vec3 tint; varying float alpha;
      void main() {
        float radius = length(gl_PointCoord - .5);
        float core = 1. - smoothstep(.09, .23, radius);
        float halo = exp(-radius * radius * 28.) * .22;
        gl_FragColor = vec4(mix(tint, vec3(1.), core * .2), (core + halo) * alpha * opacity);
        #include <colorspace_fragment>
      }`,
  });
}

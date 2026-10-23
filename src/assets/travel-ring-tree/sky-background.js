import * as THREE from 'three';

// All three details share the existing sky dome, without image downloads or another canvas.
export function memorySkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#efd6ce') }, horizonColor: { value: new THREE.Color('#fff1df') },
      cloudColor: { value: new THREE.Color('#fffdf8') }, sunColor: { value: new THREE.Color('#ffe2a7') },
      moonColor: { value: new THREE.Color('#ffedce') },
      skyTime: { value: 0 }, nightMix: { value: 0 },
      motionEnabled: { value: 0 },
      glimmerMap: { value: null }, glimmerReady: { value: 0 }, skyResolution: { value: new THREE.Vector2(1, 1) },
      glimmerScale: { value: new THREE.Vector2(1, 1) },
      sunDirection: { value: new THREE.Vector3(0, 0, -1) }, moonDirection: { value: new THREE.Vector3(0, .2, -1).normalize() },
      moonRight: { value: new THREE.Vector3(1, 0, 0) }, moonUp: { value: new THREE.Vector3(0, 1, 0) },
    },
    vertexShader: `varying vec3 vSkyDirection;
      void main() {
        vSkyDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor, horizonColor, cloudColor, sunColor, moonColor;
      uniform vec3 sunDirection, moonDirection, moonRight, moonUp;
      uniform float skyTime, nightMix;
      uniform float motionEnabled;
      uniform sampler2D glimmerMap;
      uniform float glimmerReady;
      uniform vec2 skyResolution;
      uniform vec2 glimmerScale;
      varying vec3 vSkyDirection;

      float skyHash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float skyNoise(vec2 p) {
        vec2 cell = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(skyHash(cell), skyHash(cell + vec2(1., 0.)), f.x),
          mix(skyHash(cell + vec2(0., 1.)), skyHash(cell + vec2(1.)), f.x), f.y);
      }
      float cloudField(vec2 p) {
        float cloud = 0., weight = .57;
        for (int i = 0; i < 3; i++) {
          cloud += skyNoise(p) * weight;
          p = p * 2.03 + vec2(17.4, 9.2); weight *= .5;
        }
        return cloud;
      }
      float shootingStar(vec2 pixel, float time) {
        float cycle = floor(time / 8.);
        float progress = clamp((mod(time, 8.) - .8) / 1.6, 0., 1.);
        float fade = smoothstep(0., .15, progress) * (1. - smoothstep(.82, 1., progress));
        if (fade <= 0.) return 0.;
        vec2 start = vec2((.35 + .26 * skyHash(vec2(cycle, 13.))) * skyResolution.x / skyResolution.y,
          .9 + .04 * skyHash(vec2(cycle, 27.)));
        vec2 direction = normalize(vec2(.85, -.52));
        vec2 delta = pixel - start - direction * progress * .34;
        float along = dot(delta, direction), across = dot(delta, vec2(-direction.y, direction.x));
        float width = 1.1 / skyResolution.y;
        float trail = exp(-across * across / (width * width)) * smoothstep(-.14, 0., along)
          * (1. - smoothstep(-.001, .002, along));
        float head = exp(-dot(delta, delta) / (width * width * 2.));
        float halo = exp(-dot(delta, delta) / (width * width * 30.)) * .14;
        return (trail * .9 + head * 1.5 + halo) * fade;
      }
      void main() {
        vec3 direction = normalize(vSkyDirection);
        vec3 color = mix(horizonColor, topColor, smoothstep(-.4, .55, direction.y));
        float sunDistance = length(direction - sunDirection);
        float sunlight = exp(-sunDistance * sunDistance / .055) * .38 * (1. - nightMix);
        color = mix(color, sunColor, sunlight);

        // Wide, soft wisps move slowly; freezing skyTime also freezes every cloud.
        vec2 cloudUV = vec2(direction.x * 4.5 + direction.z * 1.7, direction.y * 9.0);
        float clouds = smoothstep(.43, .68, cloudField(cloudUV + vec2(skyTime * .012, 0.)));
        clouds *= smoothstep(-.38, -.08, direction.y) * .62 * (1. - nightMix * .92);
        color = mix(color, mix(cloudColor, horizonColor, nightMix), clouds);

        vec2 glimmerUV = (gl_FragCoord.xy / skyResolution - .5) * glimmerScale + .5;
        color = mix(color, texture2D(glimmerMap, glimmerUV).rgb, nightMix * glimmerReady);

        // Only the lit crescent is painted, so its cutout keeps the sky behind it.
        vec3 relativeMoon = direction - moonDirection;
        vec2 moonUV = vec2(dot(relativeMoon, moonRight), dot(relativeMoon, moonUp)) / .018;
        float disc = 1. - smoothstep(.94, 1.04, length(moonUV));
        float cutout = smoothstep(.94, 1.04, length(moonUV - vec2(.5, .12)));
        float moonGlow = exp(-dot(moonUV, moonUV) * .26) * .085 * nightMix;
        color = mix(color, moonColor, moonGlow);
        color = mix(color, moonColor, disc * cutout * nightMix * .94);
        if (nightMix > .005 && motionEnabled > .5) {
          color += vec3(.86, .91, 1.) * shootingStar(gl_FragCoord.xy / skyResolution.y, skyTime) * nightMix;
        }
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }`,
  });
}

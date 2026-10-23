import * as THREE from 'three';

// All three details share the existing sky dome, without image downloads or another canvas.
export function memorySkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#efd6ce') }, horizonColor: { value: new THREE.Color('#fff1df') },
      cloudColor: { value: new THREE.Color('#fffdf8') }, sunColor: { value: new THREE.Color('#ffe2a7') },
      moonColor: { value: new THREE.Color('#ffedce') },
      nightTopColor: { value: new THREE.Color('#182438') }, nightMidColor: { value: new THREE.Color('#344259') },
      nightHorizonColor: { value: new THREE.Color('#495166') },
      starDensity: { value: 1 }, milkyWayStrength: { value: .003 },
      skyTime: { value: 0 }, nightMix: { value: 0 },
      motionEnabled: { value: 0 },
      skyResolution: { value: new THREE.Vector2(1, 1) },
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
      uniform vec3 nightTopColor, nightMidColor, nightHorizonColor;
      uniform float starDensity, milkyWayStrength;
      uniform vec3 sunDirection, moonDirection, moonRight, moonUp;
      uniform float skyTime, nightMix;
      uniform float motionEnabled;
      uniform vec2 skyResolution;
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
      // Adapted from CK42BB/procedural-stars-threejs (MIT, Kingsley 2026).
      // Equal-area longitude/height cells: jittered, mostly empty, with many dim stars.
      // The direction belongs to the camera-centred dome, never to a photo or screen pixel.
      vec3 distantStars(vec3 direction, float footprint) {
        vec2 grid = vec2(384., 192.);
        vec2 uv = vec2(atan(direction.z, direction.x) / 6.2831853 + .5, direction.y * .5 + .5);
        vec2 cell = floor(uv * grid);
        if (skyHash(cell + 13.1) > .048 * starDensity) return vec3(0.);
        vec2 jitter = .15 + .7 * vec2(skyHash(cell + 37.7), skyHash(cell + 91.3));
        vec2 location = (cell + jitter) / grid;
        float longitude = (location.x - .5) * 6.2831853, height = location.y * 2. - 1.;
        float radius = sqrt(max(0., 1. - height * height));
        vec3 starDirection = vec3(cos(longitude) * radius, height, sin(longitude) * radius);
        float distanceToStar = length(direction - starDirection);
        float magnitude = skyHash(cell + 57.9);
        float energy = .035 + pow(magnitude, 7.) * .48;
        float size = .00022 + pow(magnitude, 4.) * .00048;
        float width = max(size, footprint * .6);
        float core = exp(-distanceToStar * distanceToStar / (width * width));
        // Integrate subpixel stars rather than letting them blink on/off while dragging.
        float coverage = min(1., size * size / (width * width));
        float phase = skyHash(cell + 72.4) * 6.2831853;
        float speed = .24 + skyHash(cell + 25.8) * .32;
        float twinkle = 1. + sin(skyTime * speed + phase) * .09
          + sin(skyTime * speed * 1.73 + phase * 2.3) * .035;
        vec3 tint = mix(vec3(1., .9, .74), vec3(.8, .89, 1.), skyHash(cell + 104.2));
        return tint * energy * coverage * core * twinkle;
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

        // Only the lit crescent is painted, so its cutout keeps the sky behind it.
        if (nightMix > 0.) {
          // The floating garden is viewed slightly from above; its haze extends below y=0.
          float elevation = direction.y;
          vec3 night = mix(nightHorizonColor, nightMidColor, smoothstep(-.45, -.12, elevation));
          night = mix(night, nightTopColor, smoothstep(-.12, .26, elevation));
          vec2 screen = gl_FragCoord.xy / skyResolution;
          float subjectQuiet = mix(.22, 1., smoothstep(.35, 1.15,
            length((screen - vec2(.5, .5)) / vec2(.29, .48))));
          float moonDistance = length(direction - moonDirection);
          float awayFromMoon = smoothstep(.025, .13, moonDistance);
          float skyOnly = smoothstep(-.22, .07, direction.y);
          float footprint = max(length(dFdx(direction)), length(dFdy(direction)));
          night += distantStars(direction, footprint) * subjectQuiet * awayFromMoon * skyOnly;
          // Two noise scales suggest distant stardust, without a nebula or another sky pass.
          if (milkyWayStrength > 0.) {
            float latitude = dot(direction, normalize(vec3(-.34, .84, .42))) - .12;
            vec2 bandUV = vec2(atan(direction.z, direction.x) * 3., direction.y * 7.);
            float structure = skyNoise(bandUV) * .65 + skyNoise(bandUV * 2.1 + 17.) * .35;
            float band = exp(-latitude * latitude / .018) * smoothstep(.25, .72, structure);
            night += mix(vec3(.67, .72, .85), vec3(.85, .8, .74), structure)
              * band * milkyWayStrength * subjectQuiet * awayFromMoon * skyOnly;
          }
          color = mix(color, night, nightMix);
        }
        vec3 relativeMoon = direction - moonDirection;
        vec2 moonUV = vec2(dot(relativeMoon, moonRight), dot(relativeMoon, moonUp)) / .018;
        float disc = 1. - smoothstep(.94, 1.04, length(moonUV));
        float cutout = smoothstep(.94, 1.04, length(moonUV - vec2(.5, .12)));
        float moonRadius2 = dot(moonUV, moonUV);
        float moonGlow = (exp(-moonRadius2 * .26) * .035
          + exp(-moonRadius2 * .012) * .009) * nightMix;
        color = mix(color, moonColor, moonGlow);
        color = mix(color, moonColor, disc * cutout * nightMix * .94);
        if (nightMix > .005 && motionEnabled > .5) {
          color += vec3(.86, .91, 1.) * shootingStar(gl_FragCoord.xy / skyResolution.y, skyTime) * nightMix;
        }
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
        // Static sub-LSB dither avoids visible bands in the dark gradient.
        gl_FragColor.rgb += (skyHash(gl_FragCoord.xy) - .5) / 255. * nightMix;
      }`,
  });
}

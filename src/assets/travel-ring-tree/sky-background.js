import * as THREE from 'three';

// All three details share the existing sky dome, without image downloads or another canvas.
export function memorySkyMaterial() {
  const moonDirection = new THREE.Vector3(.04, .085, -1).normalize();
  const moonRight = new THREE.Vector3().crossVectors(moonDirection, new THREE.Vector3(0, 1, 0)).normalize();
  const moonUp = new THREE.Vector3().crossVectors(moonRight, moonDirection).normalize();
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color('#efd6ce') }, horizonColor: { value: new THREE.Color('#fff1df') },
      cloudColor: { value: new THREE.Color('#fffdf8') }, sunColor: { value: new THREE.Color('#ffe2a7') },
      moonColor: { value: new THREE.Color('#eef2ff') },
      nightTopColor: { value: new THREE.Color('#03091d') }, nightMidColor: { value: new THREE.Color('#081330') },
      nightHorizonColor: { value: new THREE.Color('#14223f') },
      starDensity: { value: 1 }, milkyWayStrength: { value: 0 },
      skyTime: { value: 0 }, nightMix: { value: 0 },
      motionEnabled: { value: 0 }, nightSkyRotation: { value: new THREE.Vector2(1, 0) },
      skyResolution: { value: new THREE.Vector2(1, 1) },
      sunDirection: { value: new THREE.Vector3(0, 0, -1) }, moonDirection: { value: moonDirection },
      moonRight: { value: moonRight }, moonUp: { value: moonUp },
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
      uniform vec2 skyResolution, nightSkyRotation;
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
        vec2 grid = vec2(768., 384.);
        vec2 uv = vec2(atan(direction.z, direction.x) / 6.2831853 + .5, direction.y * .5 + .5);
        vec2 cell = floor(uv * grid);
        if (skyHash(cell + 13.1) > .24 * starDensity) return vec3(0.);
        vec2 jitter = .15 + .7 * vec2(skyHash(cell + 37.7), skyHash(cell + 91.3));
        // Move only stars inside the band, using the existing star evaluation.
        float galacticLatitude = dot(direction, normalize(vec3(.23, .95, .15))) + .25;
        if (abs(galacticLatitude) < .15 && milkyWayStrength > 0.) {
          float phase = skyHash(cell + 8.2) * 6.2831853;
          jitter += .025 * vec2(sin(skyTime * .009 + phase), cos(skyTime * .006 + phase));
        }
        vec2 location = (cell + jitter) / grid;
        float longitude = (location.x - .5) * 6.2831853, height = location.y * 2. - 1.;
        float radius = sqrt(max(0., 1. - height * height));
        vec3 starDirection = vec3(cos(longitude) * radius, height, sin(longitude) * radius);
        float distanceToStar = length(direction - starDirection);
        float magnitude = skyHash(cell + 57.9);
        float energy = .085 + pow(magnitude, 6.) * .58;
        float size = .0003 + pow(magnitude, 3.) * .0007;
        float width = max(size, footprint * .6);
        // Compact antialiased point: no halo, blur or depth-of-field layer.
        float core = 1. - smoothstep(width * .25, width, distanceToStar);
        // Integrate subpixel stars rather than letting them blink on/off while dragging.
        float coverage = min(1., size * size / (width * width));
        float phase = skyHash(cell + 72.4) * 6.2831853;
        float speed = .24 + skyHash(cell + 25.8) * .32;
        float twinkle = 1. + sin(skyTime * speed + phase) * .06
          + sin(skyTime * speed * 1.73 + phase * 2.3) * .025;
        vec3 tint = mix(vec3(1., .96, .88), vec3(.9, .95, 1.), skyHash(cell + 104.2));
        return tint * energy * coverage * core * twinkle;
      }
      float galaxyHash(vec2 p) {
        p = fract(p * vec2(.1031, .11369));
        p += dot(p, p.yx + 19.19);
        return fract(p.x * p.y * 31.7);
      }
      float galaxyNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3. - 2. * f);
        return mix(mix(galaxyHash(i), galaxyHash(i + vec2(1., 0.)), f.x),
          mix(galaxyHash(i + vec2(0., 1.)), galaxyHash(i + 1.), f.x), f.y);
      }
      float galaxyCloud(vec2 p) {
        float sum = 0., weight = .52;
        for (int i = 0; i < 3; i++) {
          sum += galaxyNoise(p) * weight;
          p = mat2(.8, -.6, .6, .8) * p * 2.07 + 13.7;
          weight *= .48;
        }
        return sum;
      }
      // Detailed dust clouds are evaluated only in the small cached galaxy texture.
      vec3 galaxyLight(vec3 d, float footprint) {
        float latitude = dot(d, normalize(vec3(.23, .95, .15))) + .25;
        if (abs(latitude) > .65) return vec3(0.);
        vec2 uv = vec2(atan(d.z, d.x) * 3.5, latitude * 5.);
        vec2 drift = vec2(skyTime * .0007, skyTime * .00015);
        vec2 warp = vec2(galaxyCloud(uv + drift), galaxyCloud(uv + 17. + drift));
        float wisps = galaxyCloud(uv * 2.8 + warp * 2.7);
        float fine = galaxyCloud(uv * 8. + warp);
        float ridge = latitude + (warp.x - .5) * .17;
        float wide = exp(-ridge * ridge / .018);
        float core = exp(-ridge * ridge / .004);
        float dust = smoothstep(.38, .63, galaxyCloud(uv * 3.6 + warp * 3. + 8.));
        float lane = exp(-pow((ridge + (wisps - .5) * .24) / .025, 2.));
        float cloud = smoothstep(.16, .68, wisps) * (.65 + fine * .8);
        vec3 blue = vec3(.012, .035, .2) * wide * (.23 + cloud);
        vec3 pearl = mix(vec3(.08, .05, .19), vec3(.17, .12, .22), fine);
        vec3 light = blue + pearl * core * cloud * 1.35;
        light *= (1. - dust * .78) * (1. - lane * .72);
        return light * milkyWayStrength;
      }
      float shootingStar(vec2 pixel, float time) {
        float cycle = floor(time / 6.);
        float progress = clamp((mod(time, 6.) - .8) / 2.2, 0., 1.);
        float fade = smoothstep(0., .15, progress) * (1. - smoothstep(.82, 1., progress));
        if (fade <= 0.) return 0.;
        float side = mod(cycle, 2.) < 1. ? 1. : -1.;
        float origin = .18 + .18 * skyHash(vec2(cycle, 13.));
        vec2 start = vec2((side > 0. ? origin : 1. - origin) * skyResolution.x / skyResolution.y,
          .9 + .04 * skyHash(vec2(cycle, 27.)));
        vec2 direction = normalize(vec2(side * .85, -.42 - .22 * skyHash(vec2(cycle, 6.))));
        float distance = min(.56 + .14 * skyHash(vec2(cycle, 31.)), skyResolution.x / skyResolution.y * .75);
        vec2 delta = pixel - start - direction * progress * distance;
        float along = dot(delta, direction), across = dot(delta, vec2(-direction.y, direction.x));
        float width = .85 / skyResolution.y;
        float trail = exp(-across * across / (width * width)) * pow(smoothstep(-.22, 0., along), 1.8)
          * (1. - smoothstep(-.001, .002, along));
        float head = exp(-dot(delta, delta) / (width * width * 2.));
        float halo = exp(-dot(delta, delta) / (width * width * 30.)) * .14;
        return (trail * .9 + head * 1.5 + halo) * fade;
      }
      void main() {
        vec3 direction = normalize(vSkyDirection);
        vec3 color = mix(horizonColor, topColor, smoothstep(-.4, .55, direction.y));
        if (nightMix < 1.) {
        float sunDistance = length(direction - sunDirection);
        float sunlight = exp(-sunDistance * sunDistance / .055) * .38 * (1. - nightMix);
        color = mix(color, sunColor, sunlight);

        // Wide, soft wisps move slowly; freezing skyTime also freezes every cloud.
        vec2 cloudUV = vec2(direction.x * 4.5 + direction.z * 1.7, direction.y * 9.0);
        float clouds = smoothstep(.43, .68, cloudField(cloudUV + vec2(skyTime * .012, 0.)));
        clouds *= smoothstep(-.38, -.08, direction.y) * .62 * (1. - nightMix * .92);
        color = mix(color, mix(cloudColor, horizonColor, nightMix), clouds);

        }
        // Only the lit crescent is painted, so its cutout keeps the sky behind it.
        // Cancel only the automatic orbit; manual camera motion still sees a distant sky.
        direction.xz = mat2(nightSkyRotation.x, nightSkyRotation.y, -nightSkyRotation.y, nightSkyRotation.x) * direction.xz;
        if (nightMix > 0.) {
          // The floating garden is viewed slightly from above; its haze extends below y=0.
          float elevation = direction.y;
          vec3 night = mix(nightHorizonColor, nightMidColor, smoothstep(-.45, -.12, elevation));
          night = mix(night, nightTopColor, smoothstep(-.12, .26, elevation));
          vec2 screen = gl_FragCoord.xy / skyResolution;
          float subjectQuiet = mix(.22, 1., smoothstep(.35, 1.15,
            length((screen - vec2(.5, .5)) / vec2(.29, .48))));
          float moonDistance = length(direction - moonDirection);
          float awayFromMoon = smoothstep(.025, .1, moonDistance);
          float skyOnly = smoothstep(-.22, .07, direction.y);
          float footprint = max(length(dFdx(direction)), length(dFdy(direction)));
          night += distantStars(direction, footprint) * subjectQuiet * awayFromMoon * skyOnly;
          // Far-sky band; protect the central photo waterfall and the moon.
          if (milkyWayStrength > 0.) {
            night += galaxyLight(direction, footprint) * subjectQuiet * awayFromMoon * smoothstep(-.4, -.12, direction.y);
          }
          color = mix(color, night, nightMix);
        }
        // Angular disc in a fixed sky direction: camera translation has no parallax.
        float facingMoon = dot(direction, moonDirection);
        vec2 moonUV = vec2(dot(direction, moonRight), dot(direction, moonUp)) / .022;
        moonUV = mat2(.94, -.342, .342, .94) * moonUV;
        float moonRadius2 = dot(moonUV, moonUV);
        float aa = max(length(dFdx(moonUV)), length(dFdy(moonUV)));
        float disc = (1. - smoothstep(1. - aa, 1. + aa, length(moonUV))) * step(0., facingMoon);
        vec3 normal = vec3(moonUV, sqrt(max(0., 1. - moonRadius2)));
        float illumination = dot(normal, normalize(vec3(.91, .12, -.4)));
        float crescent = smoothstep(-aa, aa, illumination) * disc;
        float surface = 1.;
        if (nightMix > 0. && disc > 0.) {
          // Broad lunar maria and small relief, not uniform speckled noise.
          float maria = smoothstep(.3, .7, skyNoise(moonUV * 3.2 + 7.) * .7 + skyNoise(moonUV * 6. + 19.) * .3);
          surface = .94 - maria * .32 + (skyNoise(moonUV * 45.) - .5) * .07;
          float crater = length((moonUV - vec2(.55, -.35)) / vec2(.13, .1));
          surface += exp(-pow((crater - 1.) * 5., 2.)) * .1 - exp(-crater * crater * 3.) * .1;
        }
        float moonGlow = facingMoon > 0. ? (exp(-moonRadius2 * .5) * .018
          + exp(-moonRadius2 * .035) * .0025) * nightMix : 0.;
        color = mix(color, moonColor, moonGlow);
        vec3 lunarColor = moonColor * surface * (.52 + .48 * sqrt(max(0., illumination)));
        color = mix(color, lunarColor, crescent * nightMix);
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

// Only the soft galaxy is cached. Stars, moon and meteors stay at full resolution.
export class NightGalaxyCache {
  constructor(sky) {
    this.sky = sky; this.source = sky.material.fragmentShader;
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, stencilBuffer: false });
    this.material = sky.material.clone();
    this.material.fragmentShader = this.source.slice(0, this.source.indexOf('      void main()')) + `void main() {
      vec3 direction = normalize(vSkyDirection);
      float footprint = max(length(dFdx(direction)), length(dFdy(direction)));
      gl_FragColor = vec4(galaxyLight(direction, footprint), 1.);
    }`;
    this.mesh = new THREE.Mesh(sky.geometry, this.material); this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene(); this.scene.add(this.mesh);
    sky.material.uniforms.galaxyMap = { value: this.target.texture };
    sky.material.fragmentShader = 'uniform sampler2D galaxyMap;\n' + this.source.replace(
      'galaxyLight(direction, footprint) * subjectQuiet',
      'texture2D(galaxyMap, gl_FragCoord.xy / skyResolution).rgb * subjectQuiet');
    sky.material.needsUpdate = true;
    this.time = -1; this.view = new THREE.Matrix4(); this.projection = new THREE.Matrix4();
  }
  update(renderer, camera, low) {
    const u = this.sky.material.uniforms; if (u.nightMix.value <= 0.) return;
    const size = u.skyResolution.value, scale = Math.min(1, (low ? 192 : 320) / Math.max(size.x, size.y));
    const w = Math.max(2, Math.round(size.x * scale)), h = Math.max(2, Math.round(size.y * scale));
    const resized = w !== this.target.width || h !== this.target.height;
    if (!resized && this.time >= 0 && Math.abs(u.skyTime.value - this.time) < 1 / 12 && this.strength === u.milkyWayStrength.value &&
      this.view.equals(camera.matrixWorld) && this.projection.equals(camera.projectionMatrix)) return;
    if (resized) this.target.setSize(w, h);
    this.material.uniforms.skyTime.value = u.skyTime.value;
    this.material.uniforms.milkyWayStrength.value = u.milkyWayStrength.value;
    this.mesh.position.copy(camera.position);
    const previous = renderer.getRenderTarget(); renderer.setRenderTarget(this.target);
    renderer.render(this.scene, camera); renderer.setRenderTarget(previous);
    this.strength = u.milkyWayStrength.value;
    this.time = u.skyTime.value; this.view.copy(camera.matrixWorld); this.projection.copy(camera.projectionMatrix);
  }
  dispose() {
    this.sky.material.fragmentShader = this.source; this.sky.material.needsUpdate = true;
    this.target.dispose(); this.material.dispose();
  }
}

import * as THREE from 'three';
import { createGlimmerVale } from './vendor/glimmer-vale/glimmer-vale.js';

// A separate background pass keeps OriginKit's bloom away from the original photos.
export class GlimmerBackground {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.effect = createGlimmerVale(this.canvas, {
      speed: 20, scale: 85, density: 45, sparkle: 30,
      background: '#111926', skyTop: '#18253b', skyHorizon: '#3f465c',
      advanced: {
        skyMid: '#2b3750', hillShadow: '#202638', slopeColor: '#777ba5', slopeDeep: '#444b70',
        crestColor: '#e6dff5', glowColor: '#f0def0', glowStrength: 35,
        hotspotStrength: 35, horizonGlowStrength: 16, flowerCore: '#e5a089',
        midCount: 2, bokehCount: 3, grassCount: 0, glintCount: 4,
        fringe: 25, hover: 0, bob: 0,
      },
    });
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = this.texture.magFilter = THREE.LinearFilter;
    this.lastTime = -1;
  }

  update(time, width, height, lowDensity) {
    const mobile = lowDensity || width <= 760;
    // Keep a landscape field of view and crop centrally on phones, rather than stretching flowers.
    const fieldWidth = Math.max(width, height * 1.3);
    const scale = Math.min(1, (mobile ? 640 : 1280) / fieldWidth, (mobile ? 960 : 900) / height);
    const w = Math.max(2, Math.round(fieldWidth * scale)), h = Math.max(2, Math.round(height * scale));
    if (this.canvas.width === w && this.canvas.height === h && this.lastTime >= 0 && time - this.lastTime < 1 / (mobile ? 15 : 24)) return;
    // Three.js allocates immutable texture storage; a new canvas size needs fresh GPU storage.
    if (this.canvas.width !== w || this.canvas.height !== h) this.texture.dispose();
    this.effect.render(time, w, h);
    this.texture.needsUpdate = true;
    this.lastTime = time;
  }

  dispose() { this.texture.dispose(); this.effect.dispose(); }
}

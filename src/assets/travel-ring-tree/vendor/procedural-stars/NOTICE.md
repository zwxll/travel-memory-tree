# Procedural night-sky reference

Source: https://github.com/CK42BB/procedural-stars-threejs
Revision: 4c04e0391a6a707297c1a4c163c8808613eaee1b
Copyright (c) 2026 Kingsley. MIT; see LICENSE in this directory.

The existing WebGL sky dome in sky-background.js adapts the multi-stop gradient,
per-star phase/multiple-frequency twinkle, soft moon halo and faint procedural
galactic-band ideas from README.md, SKILL.md, celestial-shaders.md and
celestial-catalog.md. Equal-area sparse shader stars replace the reference's
separate Points layer. No WebGPU, textures, nebulae or external resources are used.

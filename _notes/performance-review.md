# Performance review

Reviewed 2026-09-29, after the hero resting tilt and hard-coded logo lights. Findings come from
reading the code and inspecting the models, not from profiling in a browser, so the ranking is a
judgement. Tick items off as they're done.

This folder starts with `_`, so GitHub Pages (Jekyll) leaves it out of the published site.

## Verdict for low-end hardware

- **Idle, scrolling and phones: fine.** Both 3D canvases render only on change and pause off
  screen or in a hidden tab. Pointer effects are mouse-only, so on touch devices the hero renders
  once. The main standing costs are the header blur (#4) and the full-screen masked grid layer.
- **Mouse over the hero on a weak laptop: likely to stutter.** The raycast (#1), the full-screen
  antialiased render (#3), the header blur (#4) and the split-text reads (#5) all land together.
- **First visit on a slow connection: slow hero.** The 837 KB logo plus about 1 MB of other files
  delays it noticeably (#2, and see "load starts late" below).

Suggested order: #1, #3 and #4 first (small code changes, biggest smoothness gain), then #2
(needs a re-export from Blender).

## Biggest costs

### 1. Every mouse move over the hero raycasts the full logo mesh
- [ ] Done

Update 2026-09-29: the re-exported logo is 11.8k triangles (was 38k), so this is about 3× cheaper
already. A proxy mesh would still cut it to almost nothing.

Tilt has an `onPointerMove` hook, which makes the logo "interactive", so every `pointermove`
anywhere in the hero runs `hitTest` ([model-stage.js](../assets/js/model-stage.js), `hitTest`).
Three.js tests each triangle in JavaScript with no acceleration structure. The logo fills most of
the hero, so the bounding-sphere early exit rarely skips the work. The pieces are children of the
logo root, so they're raycast too (small).

**Fix:** raycast a low-poly proxy mesh (a few hundred triangles), or test against the 2D
silhouette `captureFootprint` in [hero.js](../assets/js/hero.js) already renders.

### 2. The logo file is 837 KB
- [x] Mostly done (2026-09-29): re-exported at 214 KB, 5,905 vertices / 11,806 triangles, UVs
  dropped, same bounds so the pieces still line up. Still uncompressed; Meshopt with quantization
  could take it to roughly 50–80 KB if it's ever worth adding the decoder.

`3D_Icon_Logo.glb`: 19,010 vertices, 38,016 triangles, no compression. It also stores
`TEXCOORD_0` (UVs), which aren't used because the site's materials have no textures.

**Fix (Blender export):** drop the UVs (about 150 KB), decimate (the edges are what show), and
export with Meshopt or Draco compression. The loader needs the matching decoder
(`MeshoptDecoder` or `DRACOLoader`). Target: 100–200 KB.

### 3. The hero canvas renders at up to 2× pixel density with MSAA
- [x] Done (2026-09-29): new `maxPixelRatio` stage option; the hero passes 1.5 (`MAX_PIXEL_RATIO`
  in hero.js), the services stage keeps the default 2. Antialiasing kept.

The renderer uses `antialias: true` and `setPixelRatio(Math.min(devicePixelRatio, 2))` on a
full-viewport canvas ([model-stage.js](../assets/js/model-stage.js), setup). On a high-DPI laptop
that's millions of antialiased pixels per frame while tilting. Integrated GPUs are limited by
pixel count, not triangles.

**Fix:** cap the pixel ratio at about 1.5, or turn antialiasing off when the ratio is already 2.

### 4. Header `backdrop-filter: blur(2px)`
- [x] Done (2026-09-29): removed.

The header is fixed over the hero canvas and the grid, so the blur is recomputed whenever either
redraws and on every scroll ([styles.css](../assets/css/styles.css), `header`). This is a known
cause of scroll jank on low-end GPUs, and 2px is barely visible behind the gradient.

**Fix:** remove it, or apply it only in `header.scrolled`.

### 5. Split-text effect
- [ ] Done

About 220 letters across 6 `[data-split]` headings, each with `::before` and `::after` using
`mix-blend-mode`, so about 440 blended layers, even at opacity 0. Every mouse move also calls
`getBoundingClientRect` on each split heading, plus `getComputedStyle` for those inside a service
panel ([split-text.js](../assets/js/split-text.js), `onPointerMove`). When a style write lands in
the same frame (services scroll, grid), this forces a synchronous layout.

**Fix:** apply the blend mode only to letters that are animating (e.g. an `.is-active` class), and
cache heading bounds, invalidating them on scroll and resize (the letter positions already work
this way).

## Smaller costs

- [ ] **Grid canvas redraws the whole screen** ([grid.js](../assets/js/grid.js), `drawGrid`). Each
  update clears and redraws the full-viewport canvas at up to 2× density when only the crosses
  near the cursor changed. It allocates 2 `Path2D` per active cross per frame, and `pointermove`
  draws immediately as well as in `animate`, so some frames draw twice. The canvas also has a CSS
  `mask-image` on a fixed full-screen layer. Fix: redraw only the areas around changed crosses,
  and draw once per frame.
- [ ] **Header logo images:** `logo_wh_LR.png` (61 KB) and `logo_bl_LR.png` (63 KB) are shown at
  28px tall. Both download, even the one hidden with `display:none`, and the favicon uses the same
  files. Fix: SVG, or small WebP/PNG at display size (2–5 KB each).
- [ ] **Service models load at page start**
  ([services.js](../assets/js/services.js)), competing with the hero logo for bandwidth. Fix: load
  them when the services section is near the viewport (IntersectionObserver with a `rootMargin`).
- [ ] **The load starts late.** three.js is only requested after `main.js` runs, and the logo only
  after three.js arrives. Fix: add `<link rel="modulepreload">` for three.js and `GLTFLoader.js`,
  and `<link rel="preload" as="fetch" crossorigin>` for `3D_Icon_Logo.glb`, in `index.html`.
- [ ] **`fitLogo` can be expensive on resize** ([hero.js](../assets/js/hero.js)). The search tries
  up to 21 scales, and at each scale up to one offset per 4px of free height, sampling the text
  every 4px each time. It exits early when nothing overlaps, but on narrow screens where the text
  covers the logo it can do millions of checks per resize frame. Fix: a coarse first pass (larger
  sample and offset steps), then refine.
- [ ] **Morph pieces read layout per vertex**
  ([proximity.js](../assets/js/behaviors/shared/proximity.js) via `projectToCanvas`). They
  re-project all 882 vertices every animated frame, and `projectToCanvas` reads
  `canvas.clientWidth`/`clientHeight` for each one. Fix: cache the canvas size in the stage's
  `resize`.
- [ ] **Two WebGL contexts** (hero and services). Fine as is; noted only for memory.
- [ ] **Unused model:** `assets/models/3D_Icon_MoGraph2.glb` isn't referenced. It isn't
  downloaded by the site; it only sits in the repo.

## Already efficient (keep it this way)

- On-demand rendering in `ModelStage`, with IntersectionObserver and `visibilitychange` pausing.
- Mouse-only pointer effects, and `prefers-reduced-motion` respected throughout.
- Services scroll handler batched to one update per frame.
- Tilt physics is a trivial fixed-step spring.

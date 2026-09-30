# ArtOf_Nobody site guide

The single reference for how this site is built, where its content lives, and how to change
it safely. Read this before touching the code; it should save you from scanning the repo.

Last verified 2026-09-29, including the services zipper text. **If you change the structure, the data
pipeline or any timing that's mirrored between files, update this guide in the same commit.**

---

## 1. What this is

- **Portfolio site** for ArtOf_Nobody, a freelance VFX, CGI and motion graphics artist.
- **Static site, no build step.** Plain HTML, one stylesheet, native ES modules. There is no
  npm, no bundler and no framework, so a file saved is a file shipped.
- **Libraries:** three.js `0.161.0` (with `GLTFLoader`) from jsDelivr, mapped in an import map
  in each HTML page's `<head>`. Google Fonts: Archivo (display), Roboto (body), IBM Plex Mono
  (labels).
- **Hosting:** GitHub Pages from `main` of `github.com/ShaakirC/ArtOf_Nobody_Portfolio`. A
  push to `main` deploys.
- **Domain:** it will replace the current Wix site at `www.artofnobody.com`. It isn't live on
  that domain yet; see [section 10](#10-deploying-and-going-live).

**Run it locally** from the repo root (modules don't load over `file://`):

```sh
python -m http.server 8000   # then open http://localhost:8000/
```

---

## 2. File map

```
index.html              Home page: header, hero, services, about, contact, footer
portfolio.html          Portfolio page: every project, filterable by service tabs
_config.yml             GitHub Pages settings; only excludes developer notes from the build
CLAUDE.md               Entry point for AI agents; points here
_notes/                 Developer notes (not published: Jekyll skips folders starting with _)
  site-guide.md         This file
  performance-review.md The performance audit and what was done about each item
assets/css/styles.css   All styles, both themes, both pages
assets/images/          Header logos and favicon (logo_wh_96 / logo_bl_96 are used; the
                        _LR files are high-res originals kept for reference, not loaded)
  content/              Project preview images (WebP), referenced from projects.js
assets/models/          glTF (.glb) models: hero logo set and service icons
assets/js/
  main.js               Entry point for index.html
  portfolio-main.js     Entry point for portfolio.html
  projects.js           ★ THE CONTENT LIST: services and projects, shared by both pages
  project-tiles.js      Builds a project tile element (services previews + portfolio grid)
  portfolio.js          Portfolio page: tabs, tiles, ?service= and #slug handling
  services.js           Services section: scroll steps, transitions, icons, previews
  hero.js               Hero: logo model, fitting around the text, lighting, pieces, hit proxy;
                        on phones, the about section's loop instead
  about.js              About section: the model beside the text (a static stand-in for now)
  logo-lights.js        The logo's lighting rig (Blender sun lamps, per-theme strengths),
                        shared by the hero and about stages
  model-stage.js        Reusable WebGL canvas that shows glTF models (API documented at top)
  behaviors/            Pluggable model behaviours (tilt, pieces near the pointer, ...)
    index.js            Imports every behaviour so it registers itself
    tilt.js             Mouse-driven tilt with a spring back to a resting pose
    morph-near-pointer.js, grow-near-pointer.js, animate-near-pointer.js
                        Three ways for "pieces" to react to the cursor (hero uses morph)
    sway.js             Idle back-and-forth turn between a pose and its mirror (about logo)
    grow-cycle.js       Shape-key pieces growing, holding and receding in a random order
                        on their own (about pieces)
    shared/             Helpers for those behaviours (proximity, instancing, easing, and
                        shape-keys.js: the grow sequencing shared by morph and grow-cycle)
  split-text.js         Red/cyan split effect on headings with [data-split]
  zip-text.js           Splits a text block into per-letter clip boxes for the services zipper
  grid.js               Interactive crosshair grid drawn behind the page
  site.js               Page chrome: theme toggle, favicon, header background, footer year
```

---

## 3. Pages and their hierarchy

### index.html (top to bottom)

| Element | id / anchor | Built by | Notes |
|---|---|---|---|
| `#grid-canvas` | – | grid.js | Fixed, full-screen background grid; reacts to the mouse below the hero |
| `<header>` | – | static + site.js | Fixed. Logo, nav (Work → `#work`, About → `#about`, Contact → `#contact`), theme toggle |
| `.hero` | `#top` | static + hero.js | Eyebrow, `h1[data-split]`, scroll cue, and `#heroModel` canvas behind them |
| `.services-wrap` | `#work` (via `.services-anchor`) | static + services.js | Tall scroll track; its `.services-sticky` child pins to the screen |
| `.about` | `#about` | static + about.js | Same column layout as services: `#aboutModel` canvas in the left 25vw (the hero logo for now), `.about-text` across the rest, stats |
| `.contact` | `#contact` | static | Email, contact list |
| `<footer>` | – | static + site.js | `#year` filled in by site.js |

Inside `.services-sticky` (desktop: a 3-column grid of `25vw | 1fr | 1fr`):

1. `.services-progress`: the vertical 01/02/03 progress bar (generated by services.js).
2. `.shape-col > .shape-stage > #serviceModels`: the 3D icon canvas (left column, 25% width).
3. `.text-col > .panels > .panel` × N: one text panel per service (middle column).
4. `.preview-col > #servicePreviews`: one 2×2 `.preview-set` of project tiles per service
   (right column, same width as the text; generated by services.js).

On screens ≤ 860px wide the section stacks: header clearance, the icon row at `25vh`, then the
text. The previews are hidden, and each panel shows a "View projects →" link to that service's
portfolio tab instead. The services also swap instantly there, with no transition (see
[Services scroll](#services-scroll-servicesjs)). Phones under 700px tall (e.g. iPhone SE) get a smaller icon row (18vh)
and tighter type, so a whole service fits on the pinned screen. Check this when service copy
gets longer.

### portfolio.html

`header` → `main.portfolio` (label, `h1`, `#portfolioTabs`, `#portfolioGrid`) → `footer`. Tabs
and tiles are generated from `projects.js` by portfolio.js. There is no hero here, so the grid
background reacts everywhere.

### Script start-up

- **index.html → `main.js`:** imports `behaviors/index.js` first (so behaviours are registered
  before any model loads), then starts `initSite`, `initGrid`, `initSplitText`, `initHero`,
  `initServices({ modelsAfter: heroReady })` and `initAbout({ modelsAfter: heroReady })`. Each starts inside its own try/catch, so one
  failing feature doesn't take the others down. `initHero` returns a promise that settles when
  the logo has loaded; the services wait for it before loading their icons.
- **portfolio.html → `portfolio-main.js`:** `initSite`, `initGrid`, `initPortfolio`.

---

## 4. The content pipeline

```
                   assets/js/projects.js
          SERVICES [{ id, label }]     PROJECTS [{ slug, title, service, image }]
          PREVIEWS_PER_SERVICE         projectsFor(), findService(),
                                       projectUrl(slug), serviceUrl(id)
                 │                                   │
     ┌───────────┴──────────────┐          ┌─────────┴──────────┐
     ▼                          ▼          ▼                    │
 index.html                services.js  portfolio.js            │
 .panel[data-service=id] ──►  for each panel:  tabs = All + SERVICES
 (text, data-model)           first N projects  tiles = every project
                              of that service   (id = slug, hidden by tab)
                                     │                  │
                                     └──► project-tiles.js ◄┘
                                          createProjectTile(project)
```

### projects.js: the one place for project data

- `SERVICES`: `{ id, label }` per service. `id` joins everything together: it must match the
  `data-service` attribute of a service panel in index.html, and it's used in portfolio URLs
  (`portfolio.html?service=<id>`). `label` is shown on tabs and tiles.
- `PROJECTS`: `{ slug, title, service, image }` per project. **List order is display order**
  everywhere.
  - `slug`: unique and URL-safe (lowercase, hyphens). It becomes the tile's `id` on the
    portfolio page and the link `portfolio.html#<slug>`.
  - `service`: one of the `SERVICES` ids.
  - `image`: a path under `assets/images/content/` (any file name; the current stand-ins
    are `VFX_Comp_1.webp`, `3D_CGI_1.webp`, `MoGraph_1.webp` and so on), or `null` for an
    empty placeholder tile. Tiles are square and crop with `object-fit: cover`, so a 16:9
    image loses about 22% off each side. Use WebP, at least 800px on the short side, at
    quality 75–80, with the subject centred.
- `PREVIEWS_PER_SERVICE` (4): how many projects each service previews on the home page. The
  preview grid is 2×2, so changing this also needs a CSS change (`.preview-set`).
- Helpers: `projectsFor(serviceId)`, `findService(id)`, `projectUrl(slug)`, `serviceUrl(id)`.
  **Always build portfolio links with these**, so the URL scheme lives in one place.

### project-tiles.js: the tile contract

`createProjectTile(project, options)` returns the markup below. Pass
`{ showService: false }` to leave out the service label; the services previews do this, since
the service is already on screen.

```html
<article class="project-tile" data-project="<slug>" data-service="<id>" data-href="portfolio.html#<slug>">
  <div class="project-tile-inner">   <!-- slides within the tile's frame; carries the background -->
    <div class="project-tile-media [is-placeholder]"> <img …> (only when image is set) </div>
    <div class="project-tile-caption">
      <p class="project-tile-service">Service label</p>
      <h3 class="project-tile-title">Title</h3>
    </div>
  </div>
</article>
```

**Clicks are not wired yet, on purpose.** `data-href` holds each tile's destination for when
they are. The owner wants to design the hover and click behaviour first.

### Service panels (index.html)

Each `.panel` is one service step, in order:

```html
<div class="panel" data-i="0" data-service="vfx" data-model="assets/models/3D_Icon_VFX_COMP.glb">
  <p class="tag">VFX &amp; Compositing</p>
  <h2 data-split aria-label="…">Heading text</h2>   <!-- keep data-split: the transition needs it -->
  <p>Paragraph…</p>
  <ul><li>…</li></ul>
</div>
```

- `data-service`: which projects to preview (must be an id in `SERVICES`).
- `data-model`: the 3D icon for this step. Optional `data-model-behavior="<name>"` attaches
  a registered behaviour.
- Everything else (progress steps, preview sets, the mobile link, the scroll length) is
  generated from the number of panels.

---

## 5. Recipes

### Add a project
1. Put the image in `assets/images/content/` (WebP; see the `image` notes above).
2. Add `{ slug, title, service, image }` to `PROJECTS` in projects.js, positioned where it
   should appear.
3. That's it. It appears on the portfolio page, and on the home page if it's among the first
   `PREVIEWS_PER_SERVICE` of its service.

### Choose which projects a service previews on the home page
Reorder `PROJECTS`: each service previews its first `PREVIEWS_PER_SERVICE` projects in list
order. (If picking by order gets awkward, a `featured: true` flag filtered in services.js is
the natural next step. It isn't implemented yet.)

### Replace the placeholder projects
The 12 entries in `PROJECTS` (`vfx-01` … `mograph-04`) have placeholder titles and stand-in
images. Replace them outright; nothing else refers to those slugs.

### Edit a service's text
Edit its `.panel` in index.html. Keep `data-split` and a matching `aria-label` on the `h2`
(split-text.js reads the text from the element and sets the label, but the static label keeps
it correct before JS runs).

### Add, remove or reorder a service
1. Add, remove or move its `.panel` in index.html (order of panels = order of steps).
2. Add or remove its entry in `SERVICES`, and its projects in `PROJECTS`.
3. Give a new service a `data-model` icon (see the next recipe).
4. The scroll length adjusts itself (`sizeServices` in services.js). Each step gets
   `(2 + N × 134.67)vh − 200vh` ÷ N of scrolling on desktop (121.33 on mobile). That's about
   69vh per step at N = 3 and longer as N grows. Tune `segmentHeight` if it feels off.
5. Update the CSS fallback heights in `.services-wrap` (`406vh`, and `366vh` in the mobile
   media query) so the no-JS layout is roughly right.

### Swap a service's 3D icon
- **Export:** a `.glb` into `assets/models/`, then point the panel's `data-model` at it.
- **Orientation:** the service camera is orthographic, looking straight down (glTF −Y, which
  is Blender's Top view). About 4.2 units are visible vertically (`viewSize` in model-stage.js).
  Model it facing up in Blender and fit it inside that.
- **Animation:** the icon's animation is scrubbed by the scroll, not played in real time.
  Frame 0 shows at the start of its span and the last frame at the end. Build it in, hold,
  and build it out. Each icon plays across its own step and overlaps its neighbours in a
  window centred on the step boundary (`MODEL_OVERLAP`, 25% of a step).
- **Materials:** these are replaced with a flat Lambert in the theme colour `--model-color`.
  To keep the file's own materials, the load call would need `themed: false`.
- **Size budget:** keep each icon under ~250 KB. Service icons load after the hero logo, or on
  the first scroll, whichever comes first.

### Change the hero logo
The hero uses three files in the same coordinates. Export them together from the same Blender
scene without moving the logo:

| File | Role |
|---|---|
| `3D_Icon_Logo.glb` | The visible logo (keep it light: ~12k triangles, no UVs, ~200 KB) |
| `3D_Icon_Logo_LP.glb` | A hidden low-poly copy (~200 triangles) used only for mouse hit tests (not loaded on phones) |
| `3D_Icon_Logo_Inst.glb` | The "pieces" on its surface, with shape keys (morph-near-pointer) |

If you rename them, also update the `<link rel="preload">` tags in index.html's `<head>`,
because those must match the file names exactly. Tunables are the constants at the top of
hero.js:
- `LOGO_REST_ROTATION`: the resting tilt.
- `LOGO_HEIGHT_SHARE` / `LOGO_MAX_WIDTH_SHARE`: the logo's size.
- `TEXT_CLEARANCE`: the gap kept around the hero text.
- `LIGHTS` and `LIGHTING` (positions and strengths copied from Blender sun lamps, and
  multipliers per theme) now live in logo-lights.js, so the hero and about logos stay lit
  the same way.
- `PIECES_BEHAVIOR`: how the pieces react.
- `MAX_PIXEL_RATIO`: the render resolution cap.

### Change colours, fonts or theme
- Colour tokens are at the top of styles.css in `:root` (dark, the default) and
  `html[data-theme="light"]`.
- 3D colours come from `--model-color` and `--hero-pieces-color`, which the models re-read
  whenever the theme changes.
- Fonts are loaded in each page's `<head>` and set by `--disp`, `--sans` and `--mono`.
- The theme choice is saved in `localStorage['artofnobody-theme']`. An inline script in each
  `<head>` applies it before first paint.

### Contact details, about stats, links
- **Contact:** static HTML in the `.contact` section of index.html. The phone number, reel,
  LinkedIn and Instagram links are still **placeholders** (`#`, `+1 (000) 000-0000`).
- **Email:** `hello@artofnobody.work` appears twice there; check it's the real address.
- **About copy:** the heading, paragraphs and stats (10+, 140, 3) are static text in
  `.about-text`. The stats predate the current copy and haven't been confirmed.
- **About model:** `LOGO_SRC` / `PIECES_SRC` in about.js. It's a stand-in: the hero logo and
  its pieces, lit by the shared rig in logo-lights.js, looping on its own. Its lights turn
  with the logo like the hero's, plus up to `LIGHT_LEAD` (−20°) further toward the logo's left
  as it swings to the mirrored angle (the `sway` behaviour's `follower` option).
  - The logo sways (`sway`) between the hero's resting angle and its mirror every
    `SWAY_PERIOD` (8s).
  - The whole model can also bob up and down (the `sway` behaviour's `bob` option):
    ±`BOB_AMOUNT` of its height every `BOB_PERIOD` (5s). `BOB_AMOUNT` is 0 for now, so it
    doesn't.
  - The pieces (`grow-cycle`) grow, hold 1s and recede, a new random one every 0.6s.
  - The framing covers the whole swing. The timings are constants at the top of each
    behaviour file.

### Add a new page
Copy portfolio.html's `<head>`, header and footer, make a `<name>-main.js` entry that starts
`initSite` and `initGrid` plus the page's own module, and point the header links at
`index.html#…`.

---

## 6. How the interactive systems work

### ModelStage (model-stage.js)
One WebGL canvas that can show several glTF models. Its API is documented in the comment at
the top of the file. What matters:
- **Rendering is on demand.** A frame is drawn only after `requestRender()`, or while a
  behaviour holds a loop (`startLoop` / `stopLoop`). Nothing draws off screen or in a hidden
  tab. Keep it that way.
- **Behaviours** are registered by name (`registerBehavior`) and attached per model with the
  `behavior` load option. There are hooks for setup, per-frame update and pointer events. A
  model added to another's `root` inherits its movement, and its pointer hits count for the
  parent.
- **Camera and colours:** an orthographic camera looks down −Y, with screen up = −Z. Theme
  colours are re-applied automatically when `data-theme` changes.

### Hero (hero.js)
1. Loads the logo with the `tilt` behaviour and the `LOGO_REST_ROTATION` resting pose.
2. Measures the rotated logo, renders its silhouette once to an offscreen image, and on every
   resize solves the smallest downward offset (shrinking only if needed, to `MIN_SCALE`) that
   keeps the eyebrow, `h1` and scroll cue clear of it by `TEXT_CLEARANCE`.
3. Attaches the lights to the logo, so they turn with it, and sets their strengths per theme.
4. Attaches the low-poly hit mesh (hidden) and turns off raycasting on the full mesh.
5. Attaches the pieces (`morph-near-pointer`).
6. **Touch-first phones** (`pointer: coarse`) get no interaction, on purpose: the owner wants
   a simpler mobile interface. The logo loops on its own like the about model instead: `sway`
   (the same `SWAY_PERIOD`, 8s, and `LIGHT_LEAD`, −20°, as about.js, but no bob) and
   `grow-cycle` pieces. The fit in step 2 uses the silhouettes of poses sampled across the
   whole swing (`SWING_SAMPLES`), so no pose covers the text. The hit mesh isn't loaded.

### Services scroll (services.js)
- **Progress:** progress 0–1 runs over the `.services-wrap` scroll track and is split into N
  equal steps. The progress fill, the highlighted step number and the shown service all change
  **at the same step boundary**.
- **Panels share one grid cell and the same top edge** (`.panels` is a grid), so the lines of
  consecutive services occupy the same heights and a transition swaps them slot for slot.
- **Hold:** a service stays completely still for its step. Crossing a boundary plays a
  **timed** transition; it is not scrubbed by the scroll. The owner chose this deliberately:
  scrubbing leaves half-transitioned resting states and steps visibly with mouse wheels.
- **Transition** (CSS classes set by `showService`):
  - `.is-leaving` (0.8s): the heading's white text fades while its red/cyan copies drift 8px
    apart and fade out.
  - `.is-entering` starts 0.32s later (40% into the leave) and runs 0.8s: the copies fade in
    8px apart, converge, and hand over to the white text.
  - The tag, paragraph and list items **zip** letter by letter (zip-text.js): outgoing letters
    slide up out of their own line, and incoming ones rise from below it, one after another in
    reading order. `--zip-letter` (on `.panel` in styles.css) sets how long each letter
    takes, and `--zip-total` (0.8s, in step with the heading) how long the whole block
    takes. Start times spread over the difference by `--zip` (the letter's place in reading
    order, 0 to 1). The incoming zipper starts at 0.32s, like the incoming heading.
  - The preview tiles work like a **carousel**. Each tile's frame stays put while the
    outgoing and incoming content (`.project-tile-inner`) slide through it together, edge to
    edge, tile by tile in reading order. The direction follows the scroll: down pushes left to
    right, up pushes right to left, via `--slide-dir` (1 / −1), which `showService` sets on
    `#servicePreviews`. The timing works like the zipper: `--tile-slide` (0.5s, each tile),
    `--tile-total` (0.8s, all four) and `--tile-ease`, set on `.preview-set`. Unlike the text,
    the tiles start at 0s, with no 0.32s offset, because the two projects move as one
    strip.
  - **Hover** (preview tiles, devices that can hover): the title is hidden at rest and slides
    in from the tile's left edge while the image zooms slightly and a gradient in the panel
    colour fades up from the bottom behind the title. It's tuned by `--tile-hover-time`
    (0.6s), `--tile-hover-zoom` (1.06), `--tile-shade-height` (55%) and
    `--tile-shade-strength` (85%) on `.preview-set`. On devices
    without hover, the title just shows.
  - The list bullets and the mobile link fade over 0.5s instead, with the incoming ones
    delayed 0.32s.
  - **Keep these mirrored:** durations and delays live in styles.css (the `.panel.is-*` rules
    and `@keyframes channel-*` / `base-*`), and `LEAVE_TIME` / `ENTER_TIME` in services.js
    must equal them, because timers remove the classes. The text panels and preview sets
    get the same classes from `setStepState`.
  - **The owner tuned the feel of this by hand.** Don't change timing, distance (8px) or
    opacity (0.7 peak) without asking.
- **Small screens (≤ 860px):** no transition; services swap instantly, as with reduced
  motion. The zipper and the heading's channel copies made phone scrolling stutter. The
  breakpoint lives in both `MOBILE_QUERY` (services.js, which skips building the zip letters)
  and the instant-swap media query in styles.css. The icons still scrub with the scroll.
- **First service:** it doesn't show until the hero's bottom edge has scrolled above the
  first heading, then it plays the entrance. Scrolling back up resets it.
- **Icons:** each plays across its own step (see `modelSpan`); hand-offs overlap in a window
  centred on each boundary.

### Split text (split-text.js)
- **Which headings:** any element with `data-split` gets its letters wrapped in spans. Each
  letter has red and cyan `::before` / `::after` copies, which only exist while needed (to
  keep blended layers down).
- **Two uses:**
  - Fast mouse movement near a heading splits the nearby letters, then they decay.
  - The services transition drives the same copies through the inherited custom properties
    `--channel-split` / `--channel-opacity`, which are registered with `@property` so they can
    animate.
- **Body text is different:** the services body text uses zip-text.js, not split-text. Each
  letter is an inline-block clip box (so the proportional font loses kerning), only as tall as
  the glyphs (`--zip-mask`, 1.3em), with the rest of the line height (`--text-line`) as margin
  so the text sits exactly where plain text would,
  and screen readers get a visually hidden copy of the text. It's skipped when reduced motion
  is on at load.
- **Measuring:** letter positions are measured when the page loads and again on resize or font
  load, not during interaction.

### Background grid (grid.js)
A 2D canvas of crosshairs every 80px. Crosses near the mouse grow into lines, only below the
hero on the home page and everywhere on the portfolio page. Only changed cells are repainted,
once per frame.

### Theme and reduced motion
- **Theme:** `site.js` toggles `data-theme="light"` on `<html>`. Grid, hero lights and model
  colours watch that attribute with MutationObservers.
- **Reduced motion:** with `prefers-reduced-motion`, split letters aren't built, pointer
  effects are off, and service transitions are instant swaps.

---

## 7. Performance rules

These came out of the 2026-09-29 audit (`_notes/performance-review.md`). Don't regress them:
- **Rendering:** render on demand only. No always-on animation loops.
- **Mouse moves:** nothing that forces a layout read per mouse move. Cache sizes and rects;
  invalidate them on scroll or resize.
- **Hero canvas:** capped at `MAX_PIXEL_RATIO` 1.5.
- **Models:** hero logo about 200 KB / 12k triangles, mouse hits via the low-poly proxy,
  service icons deferred.
- **Preloads:** `<head>` preloads three.js and the hero models. Keep those URLs in sync with
  the import map and file names, or the browser downloads everything twice.
- **Header:** no `backdrop-filter` on the fixed header.
- **Idea, not done:** Meshopt-compress every model with `gltfpack` and add the decoder to
  `GLTFLoader`, once all the models are final.

---

## 8. Conventions

- **JavaScript:** ES5-style `var` and `function` (no classes, arrow functions or build
  tooling), native ES modules, one feature per file with an `initX()` export.
- **Constants:** tuning values sit at the top of their file, with a comment giving units and
  meaning.
- **Comments:** explain why and how things connect, not what the next line does.
- **CSS:** one file, organised by section comments (`/* ---------- services ---------- */`),
  with colours only via tokens.
- **Git:** short imperative subject lines, with a body explaining why for anything
  non-obvious. Git's LF→CRLF warnings on Windows are harmless.
- **No frameworks or build steps** without the owner agreeing.

---

## 9. Testing and verification

- **Serve locally** (section 1) and check both themes, desktop and ≤ 860px widths, and
  `prefers-reduced-motion`.
- **Headless Chrome** (for agents) works, but with quirks:
  - **Minimum window width:** the window can't go below ~500px. For phone sizes, load the
    page in an `<iframe>` of the target size inside a larger window.
  - **Hash scroll:** `--screenshot` of a hash-scrolled page renders wrongly. Scroll an iframe
    from a wrapper page instead.
  - **Touch-first phones:** add
    `--blink-settings=primaryPointerType=2,availablePointerTypes=2,primaryHoverType=1,availableHoverTypes=1`
    to emulate one (the hero then loops instead of following the mouse).
  - **Starved animation frames:** under `--virtual-time-budget`, `requestAnimationFrame`
    barely fires, so scroll-driven code seems not to run. From the wrapper, replace the
    iframe's `requestAnimationFrame` with a 16ms `setTimeout`.
  - **Animation clock:** CSS animations don't advance there either. Inspect a frame with
    `document.getAnimations()`, then `pause()` and set `currentTime`.
  - **Clean up:** delete temporary wrapper pages from the repo root.

---

## 10. Deploying and going live

- **Deploy:** `git push` to `main` publishes to GitHub Pages.
- **Not published:** `_notes/` (underscore folder) and `CLAUDE.md` (excluded in
  `_config.yml`).
- **Going live on `www.artofnobody.com`** (when the owner says so, not before):
  1. Add a `CNAME` file containing `www.artofnobody.com`.
  2. At the DNS provider, point `www` (CNAME) at `shaakirc.github.io`, and the apex domain
     at GitHub Pages' A records.
  3. In the repo's Pages settings, set the custom domain and enable **Enforce HTTPS**.
  4. Retire the Wix site.

---

## 11. Known gaps and open decisions

- **Project tiles:** hover and click behaviour isn't designed yet (clicks go via `data-href`
  when they are). The tiles' own transition between services is also still to be designed;
  for now they fade.
- **Placeholders:** all projects have placeholder titles and stand-in images. Some contact details and social links are
  placeholders; see recipe "Contact details".
- **Portfolio page:** there's no per-project detail view yet. `#slug` only scrolls to the
  tile.
- **Unused images:** the high-res `logo_*_LR.png` files aren't loaded. Keep or delete them
  as you like.

# ArtOf_Nobody site guide

The single reference for how this site is built, where its content lives, and how to change
it safely. Read this before touching the code; it should save you from scanning the repo.

Last verified 2026-10-02, after the portfolio rebuild (featured grid, index, detail view) and the move of project data to assets/data/projects.json. **If you change the structure, the data
pipeline or any timing that's mirrored between files, update this guide in the same commit.**

---

## 1. What this is

- **Portfolio site** for ArtOf_Nobody (Shaakir Cassiem), a Cape Town 3D studio. The work is
  organised around what clients get, in three kinds: **interactive 3D for the web** (`web`),
  **product & visualisation** (`viz`), and **film, VFX & motion** (`film`). The site itself is
  the example of the first, and the copy says so.
- **Static site, no build step.** Plain HTML, one stylesheet, native ES modules. There is no
  npm, no bundler and no framework, so a file saved is a file shipped.
- **Libraries:** three.js `0.161.0` (with `GLTFLoader`) from jsDelivr, mapped in an import map
  in each HTML page's `<head>`. Fonts (self-hosted in `assets/fonts/`): Archivo 600 (display), Roboto 400 (body), IBM Plex Mono 400
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
portfolio.html          Portfolio page: intro, featured grid, project index, detail view
README.md               How to run the site locally (not published)
_config.yml             GitHub Pages settings; keeps notes, docs and tools out of the build
CLAUDE.md               Entry point for AI agents; points here
_notes/                 Developer notes (not published: Jekyll skips folders starting with _)
  site-guide.md         This file
  performance-review.md The performance audit and what was done about each item
assets/css/styles.css   All styles, both themes, both pages
assets/fonts/           Self-hosted WOFF2 fonts (Archivo, Roboto, IBM Plex Mono; Latin + Latin Ext)
assets/images/          Header logos and favicon (logo_wh_96 / logo_bl_96 are used; the
                        _LR files are high-res originals kept for reference, not loaded)
  content/              Stand-in project images (WebP), referenced from projects.json
assets/data/
  projects.json         ★ THE CONTENT: categories and every project, for both pages
  README.md             Every field, and the client-crediting rules (not published)
assets/reels-draft/     Looping service reels (WebM), referenced from projects.json. Ignored by
                        git (.gitignore) until optimised; then they move to assets/reels/
tools/                  Not published
  csv-to-projects.mjs   Node script: master spreadsheet (CSV) → assets/data/projects.json
  update-projects.cmd   Double-click wrapper for it (default input tools/data/projects.private.csv)
  data/                 Git-ignored: the owner's master spreadsheet, projects.private.csv
  projects-template.csv The spreadsheet's columns, with one example row
assets/models/          glTF (.glb) models: hero logo set and service icons
assets/js/
  main.js               Entry point for index.html
  portfolio-main.js     Entry point for portfolio.html
  projects.js           Loads and checks projects.json; helpers both pages use (the only
                        module that fetches it)
  project-rules.js      The data checks, shared with tools/csv-to-projects.mjs (no DOM)
  portfolio.js          Portfolio page: clients line, featured grid, index, filters, sort, URLs
  portfolio-detail.js   The detail view (<dialog>): page or lightbox, video embeds
  services.js           Services section: scroll steps, transitions, icons, reels
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
| `<header>` | – | static + site.js | Fixed. Logo, nav (Work → `portfolio.html`, About → `#about`, Contact → `#contact`), theme toggle |
| `.hero` | `#top` | static + hero.js | Eyebrow, `h1[data-split]`, scroll cue, and `#heroModel` canvas behind them |
| `.services-wrap` | `#work` (via `.services-anchor`) | static + services.js | Tall scroll track; its `.services-sticky` child pins to the screen |
| `.about` | `#about` | static + about.js | Same column layout as services: `#aboutModel` canvas in the left 25vw (the hero logo for now), `.about-text` across the rest, stats |
| `.contact` | `#contact` | static | Email, contact list |
| `<footer>` | – | static + site.js | `#year` filled in by site.js |

Inside `.services-sticky` (desktop: a 3-column grid of `25vw | 1fr | 1fr`):

1. `.services-progress`: the vertical 01/02/03 progress bar (generated by services.js).
2. `.shape-col > .shape-stage > #serviceModels`: the 3D icon canvas (left column, 25% width).
3. `.text-col > .panels > .panel` × N: one text panel per service (middle column).
4. `.preview-col > #serviceReels`: one 16:9 frame holding an `a.reel` per service, each a
   looping video linking to that service's portfolio section (right column, same width as the
   text; generated by services.js). The text stops at `--panel-max` (560px), so the column is
   shifted left by half the leftover space to keep equal gaps between the text, the reel and
   the screen edge (`left` on `.preview-col`).

On screens ≤ 860px wide the section stacks: header clearance, the icon row at `25vh`, then the
text. The reels are hidden (and their videos never fetched), and each panel shows a "View
projects →" link to the same portfolio section instead. The services also swap instantly there, with no transition (see
[Services scroll](#services-scroll-servicesjs)). Phones under 700px tall (e.g. iPhone SE) get a smaller icon row (18vh)
and tighter type, so a whole service fits on the pinned screen. Check this when service copy
gets longer.

### portfolio.html

`header` → `main.portfolio` → `dialog#pfDetail` → `footer`.
`main` holds static shells that portfolio.js fills from the data:

1. `.pf-intro`: label, `h1`, lede, and `#pfClients` ("Clients include A, B and C.", up to
   `MAX_CLIENTS` brands; stays `hidden` with none).
2. `#pfFeaturedSection > #pfFeatured`: the featured cards, in a 3-column grid of fixed-height
   rows (`wide` spans two columns, `tall` two rows, dense packing); 2 columns below 1024px,
   one full-width 16:10 card each below 720px. Hidden when nothing is featured. Hover loops
   play only on a fine pointer without reduced motion, and their video isn't created (so
   nothing downloads) until the first hover.
3. `.pf-index`: `#pfFilters` (All + one per category, `aria-pressed`), `#pfCount` (live
   region), the column header (Year and Client are sort buttons), `#pfIndex` (one `li.pf-row`
   per project) and `#pfEmpty`. The rows and header share one grid, `--pf-cols`; below 720px
   each row folds into "Client — Project" over "Year · Role · Pillar".

**URL state:** `?category=<id>&sort=<sort>` holds the filter and sort (`sort` is omitted for
the default, year newest first; `client`, `client-desc` and `year-asc` otherwise), written
with `history.replaceState`. Old `#<category>` links still select that filter.
`#project-<id>` opens the detail view, on load too; opening and closing swap the hash without
adding history entries.

**Opening projects:** cards and rows with a detail view are `<a href="#project-<id>"
data-project>`; a plain click is intercepted to open the dialog in place (modified clicks still
work as links). Rows with `detail: "none"` are a plain `div`, not focusable.

**Detail view** (portfolio-detail.js): a native `<dialog>` with `showModal()`, rebuilt for
each project. `"page"` shows credits, tags, summary, the video and breakdown images;
`"lightbox"` just the video (or poster/thumb). `media.video` can be a local file (`<video
controls>`) or a YouTube/Vimeo URL (a lazy iframe: youtube-nocookie.com, Vimeo with
`dnt=1`). Escape, the close button and a backdrop click close it; closing empties it (stopping
playback), returns focus to the opener and clears the hash. The page scroll is locked
meanwhile (`html.is-scroll-locked`), with the scrollbar's width (`--scrollbar-comp`) given
back to the body, header and grid canvas so nothing shifts. The close event arrives
asynchronously, so the handler ignores it if the dialog has already reopened.

**Row hover:** a row with a detail view brightens and its text steps 6px right on hover and
keyboard focus (CSS only). There was a thumbnail that followed the cursor over the index; the
owner removed it (2026-10-02) as too gimmicky for the site, so don't bring it back unasked.

**Loading:** `main` starts as `.is-loading`, which keeps the index invisible (but in place)
until the data has rendered, so the featured grid appearing above it isn't a layout shift. If
the JSON fails to load, a `.pf-error` message replaces the content.

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
                    assets/data/projects.json
         { version, categories: [{ id, label, reelPlaceholder? }], projects: [...] }
                               │  (fetched and checked once)
                    assets/js/projects.js   ◄── project-rules.js (checks; also used by
                    loadProjects() + helpers         tools/csv-to-projects.mjs)
                 ┌─────────────┴──────────────┐
                 ▼                            ▼
            services.js                  portfolio.js
  each .panel[data-service=id] gets   clients line, featured grid, index,
  reelProjects(data, id)[0]'s loop,   detail view (portfolio-detail.js),
  or the category's reelPlaceholder
```

**The field reference and the client-crediting rules are in `assets/data/README.md`.** Keep
that file up to date with any schema change. In short: each project has `id`, `title`, `year`,
`client` (`name`, `via`, `display`: `name` / `anonymised` / `hidden`, `anonymisedLabel`,
`highlight`), `role`, `categories` (first = primary), `summary`, `tools`, `featured`,
`detail` (`page` / `lightbox` / `none`), `media` (`thumb`, `thumbAlt`, `poster`,
`hoverLoop`, `video`, `breakdown`), `serviceReel`, `concept` and `draft`.

- **The JSON is public** (anyone can open it on GitHub Pages). Anonymised and hidden projects
  must have `client.name` and `client.via` set to `null`; the loader warns and the import
  script refuses to write otherwise.
- **projects.js** is the only way in. `loadProjects()` fetches the file once (relative to the
  module, so it works on any base URL), runs `validateProjects()` and logs one grouped
  `console.warn` for missing or inconsistent data. Helpers: `visibleProjects` (no drafts, no
  hidden clients), `featuredProjects`, `indexProjects(data, { category, sort })`,
  `highlightedClients`, `reelProjects(data, category)`, `clientLabel(project)` ("Brand (via
  Agency)" / anonymised label), `findCategory`, `primaryCategory`, `isLocalVideo`. The URL
  builders `projectUrl(id)` (`portfolio.html#project-<id>`) and `serviceUrl(id)`
  (`portfolio.html?category=<id>`) need no data, so the home page uses them straight away.
- **Categories:** `film`, `viz`, `web`, in the order of the service panels; that order is
  also the filter order. A category's `reelPlaceholder` (`{ title, note }`) fills its reel
  frame while no project supplies a reel (`web`: "You're looking at it.").
- **Home page reels:** a project with `serviceReel: true` lends its `hoverLoop` (or a local
  `video`) to the reel of its primary category. The current reels come from two hidden-client
  entries, `showreel-film` and `showreel-viz`, which never show in the index. services.js
  builds the reel frames straight away and fills them when the data arrives; without data
  they stay empty frames that still link to the portfolio.
- **Spreadsheet import:** `node tools/csv-to-projects.mjs <file.csv> [out.json]` (Node 22+, no
  dependencies) rewrites projects.json from the master spreadsheet, keeping the existing
  `categories`. It strips client names from anonymised/hidden rows, never writes `private_*`
  columns, and fails if a confidential name would get through. The spreadsheet must stay out
  of the repo: `*.private.csv` and `tools/data/` are git-ignored.

### Service panels (index.html)

Each `.panel` is one service step, in order:

```html
<div class="panel" data-i="0" data-service="film" data-model="assets/models/3D_Icon_VFX_COMP.glb">
  <p class="tag">Film, VFX &amp; Motion</p>
  <h2 data-split aria-label="…">Heading text</h2>   <!-- keep data-split: the transition needs it -->
  <p>Paragraph…</p>
  <ul><li>…</li></ul>
</div>
```

- `data-service`: which category's reel and portfolio filter it shows (must be a category id
  in projects.json).
- `data-model`: the 3D icon for this step. Optional `data-model-behavior="<name>"` attaches
  a registered behaviour. The icons are stand-ins from the old services (film: VFX_COMP, viz:
  3D_CGI, web: MoGraph) until `3D_Icon_Film.glb`, `3D_Icon_Viz.glb` and `3D_Icon_Web.glb`
  exist; a TODO above the panels names them. Each icon's animation lives in its file, so
  nothing else changes when one is swapped.
- Everything else (progress steps, reels, the mobile link, the scroll length) is
  generated from the number of panels.

---

## 5. Recipes

### Add a project
1. Put its media under `assets/` (WebP stills, small WebM loops under 2 MB; long videos on
   YouTube or Vimeo instead, since GitHub rejects files over 50 MB). Paths are relative and
   case-sensitive on GitHub Pages.
2. Add it to the master spreadsheet (`tools/data/projects.private.csv`, edited by the owner
   in Tablecruncher) and double-click `tools/update-projects.cmd`, or add an entry to
   `assets/data/projects.json` directly (see `assets/data/README.md`). List order is the
   order featured cards fall back to and nothing else: the index sorts by year.
3. Reload the portfolio and check the console for validation warnings. To stage a project,
   set `draft: true`; three concept drafts (site model, gin hero, table configurator) wait
   for media this way.

### Swap a service's reel
Point the `hoverLoop` of the project flagged `serviceReel` for that category (currently
`showreel-film` and `showreel-viz`) at the new file, or flag a different project. `web` has
none yet, so its frame shows its `reelPlaceholder`. The current stand-ins live in
`assets/reels-draft/`, which `.gitignore` keeps out of the repo, so the deployed site has no
reels yet (the frame shows the panel colour). When they're re-exported, move them to
`assets/reels/`, update the paths, and remove that `.gitignore` entry. Use a muted 16:9 WebM
that loops cleanly. The current reels (9–31 MB) are unoptimised stand-ins: re-export them at
around 3–6 MB each (720p–1080p, VP9) before going live, and consider an MP4 alongside for
older Safari. Loading is lazy: nothing is fetched until the first scroll (never on ≤ 860px
screens), then each reel loads its metadata and buffers in full once it plays.

### Replace the placeholder projects
The 12 entries `vfx-01` … `mograph-04` in projects.json have placeholder titles, stand-in
images and no year, client or role; four of them are featured only so the grid has something
to show. Their categories follow the old services (VFX and motion → `film`, CGI → `viz`).
Replace them outright; nothing else refers to those ids.

### Edit a service's text
Edit its `.panel` in index.html. Keep `data-split` and a matching `aria-label` on the `h2`
(split-text.js reads the text from the element and sets the label, but the static label keeps
it correct before JS runs).

### Add, remove or reorder a service
1. Add, remove or move its `.panel` in index.html (order of panels = order of steps).
2. Add, remove or move its entry in `categories` in projects.json (and the import script's
   `DEFAULT_CATEGORIES`), and update its projects' `categories`. Its filter button appears by
   itself.
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
- Fonts are `@font-face` rules at the top of styles.css (files in `assets/fonts/`, two preloaded in each page's `<head>`) and are set by `--disp`, `--sans` and `--mono`. To add a weight, download its Latin and Latin Extended WOFF2 from Google Fonts and add a rule for each.
- The theme choice is saved in `localStorage['artofnobody-theme']`. An inline script in each
  `<head>` applies it before first paint.

### Contact details, about stats, links
- **Contact:** static HTML in the `.contact` section of index.html. The email
  (`info@artofnobody.com`, twice) and phone are real. The LinkedIn and Instagram links are
  still **placeholders** (`href="#"`, handles unconfirmed; a TODO marks them).
- **Search and sharing:** index.html's `<head>` has a canonical URL, Open Graph / Twitter tags
  and JSON-LD (`ProfessionalService`), all pointing at `https://www.artofnobody.com/`. The OG
  image (`assets/images/og-image.jpg`, 1200×630) doesn't exist yet.
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
  - The reels work like a **carousel**. The 16:9 frame stays put while the outgoing and
    incoming reels (`.reel-inner`) slide through it together, edge to edge. The direction
    follows the scroll: down pushes left to right, up pushes right to left, via `--slide-dir`
    (1 / −1), which `showService` sets on `#serviceReels`. `--tile-slide` (0.5s, the same push
    each of the old preview tiles had) and `--tile-ease` are set on `.reel-frame`. Unlike the
    text, the push starts at 0s, with no 0.32s offset.
  - **Playback:** only the shown reel plays. An incoming reel restarts from 0 (unless it was
    still playing on its way out); the outgoing one plays on through its slide, then pauses
    `LEAVE_TIME` later. All pause once the frame scrolls out of view (an
    IntersectionObserver).
  - **Hover** (devices that can hover, and keyboard focus): the "View <label> projects →"
    label is hidden at rest and slides in from the frame's left edge while the video zooms
    slightly and a gradient in the panel colour fades up from the bottom behind it. It's tuned
    by `--tile-hover-time` (0.6s), `--tile-hover-zoom` (1.06), `--tile-shade-height` (40%) and
    `--tile-shade-strength` (85%) on `.reel-frame`. On devices without hover, the label just
    shows. Clicking goes to `serviceUrl(id)`, the same as the mobile link.
  - The list bullets and the mobile link fade over 0.5s instead, with the incoming ones
    delayed 0.32s.
  - **Keep these mirrored:** durations and delays live in styles.css (the `.panel.is-*` rules
    and `@keyframes channel-*` / `base-*`), and `LEAVE_TIME` / `ENTER_TIME` in services.js
    must equal them, because timers remove the classes. The text panels and reels get the
    same classes from `setStepState`.
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
- **When:** the service headings are split at load (their transition needs the letters).
  Every other heading, the hero's included, stays plain text until a mouse first moves, so
  touch screens never split them. Rebuilding the hero heading at load made it the page's
  largest paint (LCP), which then waited on three.js; Lighthouse mobile scored 72 because of
  it. Keep the hero heading out of anything that rewrites it at load.
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
- **Fonts:** self-hosted in `assets/fonts/` (no Google Fonts connections before first paint).
  Each page preloads the Archivo and Plex Mono Latin files; keep those links in sync with the
  `@font-face` rules at the top of styles.css. Don't add weights the CSS doesn't use.
- **Largest paint:** the hero heading. Nothing should rewrite it at load (see Split text).
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
  - **Media and dialogs:** under virtual time, videos never load and a `<dialog>`'s close
    event never arrives. Test those in real time (below).
  - **Clean up:** delete temporary wrapper pages from the repo root.
- **Real-time browser tests:** Node isn't installed on the owner's machine. A portable Node
  in the scratchpad plus `npm install lighthouse` brings `puppeteer-core`, which drives the
  installed Chrome with real mouse, keyboard and touch input, media-feature emulation and
  network logging. Swap in a test projects.json that covers every case (back up the real one
  and restore it afterwards). Lighthouse from the same install gives mobile scores; on the
  local Python server files aren't compressed, so compare like with like.

---

## 10. Deploying and going live

- **Deploy:** `git push` to `main` publishes to GitHub Pages.
- **Not published:** `_notes/` (underscore folder), and `CLAUDE.md`, `README.md`, `tools/`
  and `assets/data/README.md` (excluded in `_config.yml`). **Don't add a `.nojekyll` file:**
  without Jekyll all of these would be published. Jekyll only skips names starting with `_`
  or `.`, and the site has none, so it leaves the site's own files alone.
- **Paths:** keep every asset path relative (`assets/...`, never `/assets/...`) so the site
  works both on github.io/<repo>/ and the custom domain, and match file-name case exactly.
- **Going live on `www.artofnobody.com`** (when the owner says so, not before):
  1. Add a `CNAME` file containing `www.artofnobody.com`.
  2. At the DNS provider, point `www` (CNAME) at `shaakirc.github.io`, and the apex domain
     at GitHub Pages' A records.
  3. In the repo's Pages settings, set the custom domain and enable **Enforce HTTPS**.
  4. Retire the Wix site.

---

## 11. Known gaps and open decisions

- **Reels:** stand-in exports, too heavy for go-live (see recipe "Swap a service's reel").
- **Placeholders:** all projects have placeholder titles, stand-in images and no year,
  client or role (26 validation warnings, by design). Which projects to feature and which
  clients to highlight are still to decide. Some contact details and social links are
  placeholders; see recipe "Contact details".
- **Stand-ins awaiting assets:** the three service icons, the `web` reel, the OG image, the
  social links and the three draft concept projects.
- **Unused images:** the high-res `logo_*_LR.png` files aren't loaded. Keep or delete them
  as you like.

# ArtOf_Nobody portfolio site

Static portfolio site (plain HTML, one CSS file, native ES modules, three.js from a CDN). There
is no build step, and it deploys to GitHub Pages on push to `main`.

**Read `_notes/site-guide.md` before making changes.** It maps every file, the content
pipeline, recipes for common edits (projects, services, 3D models, theme), how each
interactive system works, and headless-testing quirks. Keep it up to date when you change
structure, data flow or mirrored timings.

Quick facts:
- **Content:** projects and services come from `assets/js/projects.js`, which both
  `index.html` (services previews) and `portfolio.html` read. Service text and icons are
  `.panel` elements in `index.html`, joined to the list by `data-service`.
- **Run locally:** `python -m http.server` from the repo root (modules don't load from
  `file://`).
- **Style:** ES5-style `var`/`function`, tuning constants at the top of each file, comments that
  explain why. No frameworks or build tooling without asking.
- **Timings:** the services transition timings in `styles.css` and `services.js` mirror each
  other. The owner tuned them by hand, so ask before changing them.
- **Going live:** don't add a `CNAME` or suggest DNS changes until the owner says it's time.

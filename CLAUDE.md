# ArtOf_Nobody portfolio site

Static portfolio site (plain HTML, one CSS file, native ES modules, three.js from a CDN). There
is no build step, and a push to `main` updates its GitHub Pages build.

**THE SITE IS LIVE** at https://artofnobody.com (since 2026-10-06; `www` and `http` redirect
there). A push to `main` goes straight to visitors within a minute or two, so test locally first
and ask the owner before pushing. The domain lives in `CNAME`: never delete or overwrite it, and
fetch before pushing, since GitHub can commit to `main` too.

**Read `_notes/site-guide.md` before making changes.** It maps every file, the content
pipeline, recipes for common edits (projects, services, 3D models, theme), how each
interactive system works, and headless-testing quirks. Keep it up to date when you change
structure, data flow or mirrored timings.

Quick facts:
- **Content:** categories and projects live in `assets/data/projects.json` (fields and
  client-crediting rules in `assets/data/README.md`), loaded only through
  `assets/js/projects.js` by both `index.html` (service reels) and `portfolio.html`. Service
  text and icons are `.panel` elements in `index.html`, joined to a category by
  `data-service`. The JSON is public: never put a confidential client name in it.
- **Run locally:** `python -m http.server` from the repo root (modules don't load from
  `file://`).
- **Style:** ES5-style `var`/`function`, tuning constants at the top of each file, comments that
  explain why. No frameworks or build tooling without asking.
- **Timings:** the services transition timings in `styles.css` and `services.js` mirror each
  other. The owner tuned them by hand, so ask before changing them.
- **Deploying:** see `_notes/site-guide.md` section 10 for the workflow and for unsticking a
  Pages build that sits queued.

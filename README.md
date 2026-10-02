# ArtOf_Nobody

Portfolio site for ArtOf_Nobody, a 3D studio in Cape Town. It's plain HTML, CSS and ES modules
with no build step, and is hosted on GitHub Pages.

Run it from a local server, because pages that load modules and `assets/data/projects.json` don't
work when opened as files: `python -m http.server` (or `npx serve .`) in this folder, then
open http://localhost:8000/.

- **Projects:** the project data lives in `assets/data/projects.json`; see
  `assets/data/README.md` for the fields and how to update the file from a spreadsheet.
- **How the site works:** see `_notes/site-guide.md`.

# ArtOf_Nobody

Portfolio site for ArtOf_Nobody, a 3D studio in Cape Town making interactive 3D websites,
product and architectural visualisation, and VFX and motion for film and broadcast.

**Live at https://artofnobody.com**

It's plain HTML, one CSS file and native ES modules (three.js from a CDN), with no build step.
GitHub Pages hosts it straight from `main`.

## Running it locally

Pages that load modules and `assets/data/projects.json` don't work when opened as files, so
serve the folder instead: run `python -m http.server` (or `npx serve .`) here, then open
http://localhost:8000/.

## Publishing changes

A push to `main` goes live on artofnobody.com within a minute or two. Check it locally first;
the build shows under the **Actions** tab (a green tick means it's deployed).

- Keep the `CNAME` file. It holds the custom domain, and deleting it takes the site off
  artofnobody.com.
- `_config.yml` keeps the developer files (`_notes/`, `tools/`, the READMEs, `CLAUDE.md`) off
  the published site. Don't add a `.nojekyll` file, or they'd be published too.

## Updating content

- **Projects:** the project data lives in `assets/data/projects.json`, built from a private
  spreadsheet with `tools/update-projects.cmd`. See `assets/data/README.md` for the fields and
  the rules for crediting clients. The repository is public, so confidential client names must
  never go in the JSON.
- **How the site works:** see `_notes/site-guide.md`.

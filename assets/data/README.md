# Project data

`projects.json` is the one list of projects for the whole site. The portfolio page builds its
featured grid, index and detail views from it, and the home page takes its service reels from
it. Pages read it through `assets/js/projects.js`; nothing else opens the file.

**This repository is public, and so is this file.** Anyone can open
`assets/data/projects.json` in a browser. Never put a confidential client name in it, not even
for a project whose name the site hides.

## Editing it from a spreadsheet

The master list is `tools/data/projects.private.csv`: one row per project, with the columns
in `tools/projects-template.csv`. It holds every project, including the hidden showreel rows
that feed the home page reels, because converting it **replaces** this file. Edit it in a
spreadsheet app (Tablecruncher, Excel, Google Sheets) and save it as CSV: UTF-8, comma
separated.

To update the site, double-click `tools/update-projects.cmd` (or drag a different CSV onto it),
or run:

```sh
node tools/csv-to-projects.mjs tools/data/projects.private.csv
```

That rewrites this file. The script needs Node 22 or later and has no dependencies.

- **Keep the spreadsheet out of the public repo.** Store it outside the repository, or name it
  `*.private.csv`, or put it in `tools/data/`. Git ignores both of those, which also means
  GitHub doesn't back it up: keep a copy somewhere synced.
- Columns whose names start with `private_` (for example `private_notes`) stay in the
  spreadsheet and are never written to the JSON.
- For anonymised and hidden projects, the script removes `client_name` and `client_via`
  before writing. It refuses to write the file if a confidential name would get through.
- In the spreadsheet, list cells (role, categories, tools, breakdown) are separated by `|`.
  Yes/no cells accept `TRUE`/`FALSE`, `yes`/`no` or `1`/`0`.
- The site checks the data whenever a page loads, and so does the script. Problems show as
  warnings in the browser console and the script's output.

## Crediting clients

Every project has a `client` with a `display` setting:

| `display` | What the site shows | What goes in the file |
|---|---|---|
| `"name"` | The brand, as **Brand (via Agency)** when `via` is set (standard production crediting). | `name`, and `via` if the work came through an agency or production house. |
| `"anonymised"` | `anonymisedLabel` instead, such as "Global beverage brand". Use this for NDA work. | `anonymisedLabel` only. `name` and `via` **must be `null`**. |
| `"hidden"` | Nothing. The project stays out of the index and the clients line, though it can still feed a home page reel. | `name` and `via` **must be `null`**. |

- **Self-initiated work:** set `client.name` to `"Self-initiated"`, `display` to `"name"` and
  `concept` to `true`. It always shows a **Concept** tag and never appears in "Clients include…".
- **"Clients include…":** the portfolio intro lists up to 6 brands that have `highlight: true`
  and `display: "name"`, excluding concept work. They appear once each, in the order they
  first appear in this file, by brand name only (no "via").

## Fields

The top level holds `version` (currently `1`), `categories` and `projects`.

**`categories`** is the three services, in the order the site lists them:
- `id`: `film`, `viz` or `web`. Projects refer to these ids.
- `label`: the name shown in filters, tags and the reel's hover text.
- `reel` (optional): the ids of the projects whose videos the home page reel plays, in order,
  such as `["everyday-impossible", "music-video-VFX"]`. Any project can be listed, whatever its
  categories; drafts and projects without a video on the site are skipped. Without a list, the
  reel plays every project whose main category this is. Edit it here: the spreadsheet import
  keeps the categories as they are.
- `reelPlaceholder` (optional): `{ title, note }`, shown in the home page reel frame while no
  project supplies a reel for that category.

**Each project:**

| Field | Meaning |
|---|---|
| `id` | Unique, lowercase, hyphens (`my-project-name`). Used in links: `portfolio.html#project-<id>`. |
| `title` | The project's name. Required. |
| `year` | A number, such as `2024`. Required. |
| `client` | See *Crediting clients* above: `name`, `via`, `display`, `anonymisedLabel`, `highlight`. |
| `role` | What Shaakir did, not what the whole production did, such as `["Compositing", "Tracking"]`. Shown joined with " · ". |
| `categories` | One or more of `film`, `viz`, `web`. The first is the project's main category (shown in the index and used for reels). A project shows under every filter it lists. |
| `summary` | One or two sentences on the brief and what was delivered (detail view). |
| `tools` | Software used, such as `["Blender", "DaVinci Resolve"]` (detail view). |
| `link` | Optional. A full `https://` address for the live site, case study or article, or `null`. Shown on a `"page"` detail as a **Link** row under Role and Tools, labelled by its address and opening in a new tab. |
| `featured` | `null`, or `{ "order": 1, "layout": "wide" }` to put it in the featured grid at the top of the portfolio. `layout` is `"wide"` (two columns), `"standard"` (one cell) or `"tall"` (two rows). Featured projects also appear in the index. |
| `detail` | What clicking it opens: `"page"` (the full write-up: credits, summary, video, breakdown images), `"lightbox"` (just the video, or the image when there's no video) or `"none"` (an unclickable credit). |
| `media.thumb` | Still image for the featured card, and the lightbox when there's no video or poster. Required for featured projects. |
| `media.thumbAlt` | What the thumbnail shows, for screen readers. |
| `media.poster` | A still shown before the video plays (falls back to `thumb`). |
| `media.hoverLoop` | A short silent loop that plays while hovering a featured card. Keep it a small WebM, under 2 MB. Only featured cards (and home page reels, when there's no local `video`) use it: the project index is text only and shows no media on hover. |
| `media.video` | The main video: a file on the site, or a YouTube or Vimeo link (embedded in the detail view, YouTube through youtube-nocookie.com). Long films belong on YouTube or Vimeo: GitHub rejects files over 50 MB. |
| `media.breakdown` | Images shown one after another under the video on a `"page"` detail. |
| `serviceReel` | `true` puts this project first in the home page reel for its first category (even with a hidden client). Every other project with a local `video` or a `hoverLoop` plays in that reel too, featured ones first. |
| `concept` | `true` for self-initiated work. Adds a **Concept** tag everywhere. |
| `draft` | `true` keeps the project off the site entirely, for work that isn't ready. |

Every media path is optional except a featured project's `thumb`, and anything missing is
simply left out. Media lives in `assets/content/`: stills in `assets/content/images/<id>/`,
videos in `assets/content/videos/<id>/` (`assets/images/` is for site branding only, and the
site warns about media paths elsewhere). Paths are relative (`assets/content/...`, never `/assets/...`) and
case-sensitive on GitHub Pages, so `Thumb.webp` and `thumb.webp` are different files.

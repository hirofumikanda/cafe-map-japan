---
name: run-cafe-map-web
description: Build, launch, and drive the cafe-map-japan web map (MapLibre + PMTiles) in this headless container. Use to run / start / serve / screenshot the map, verify a viewer change visually, or click a POI popup via Playwright + Chromium.
---

# Run: cafe-map-japan web viewer

Static MapLibre GL JS map. No bundler — `npm run build` copies vendor ESM +
`src/*.js` into `public/`, and `server/serve.js` serves `public/` with HTTP
Range support (PMTiles needs 206 responses). There is **no dev server with
HMR**; you rebuild and reload.

Driven headlessly by **`driver.mjs`** in this skill dir: it builds, starts
the static server on an ephemeral port, launches Chromium through Playwright
with the two workarounds this container needs (see Gotchas), and
screenshots / clicks the map.

All paths below are relative to `web/` (the unit dir). Run everything from
there.

## Prerequisites

- **Node** — v22.18.0 here.
- **Playwright + Chromium.** Not a project dependency. `driver.mjs` resolves
  the `playwright` package from `web/node_modules` **or** npx's cache
  (`~/.npm/_npx/*/node_modules/playwright`; v1.62.1 is already there), and
  resolves a Chromium build from `~/.cache/ms-playwright/chromium-*`. If the
  driver reports either is missing:
  ```bash
  npm install --no-save playwright@1.62.1
  npx playwright install chromium
  ```
- **libasound2** — fetched automatically by the driver (no root needed): it
  runs `apt-get download libasound2t64`, extracts `libasound.so.2` into
  `.claude/skills/run-cafe-map-web/.libshim/`, and puts that on
  `LD_LIBRARY_PATH`. Needs outbound access to `archive.ubuntu.com` once.
- **Outbound network** at run time for OSM raster tiles
  (`tile.openstreetmap.org`) and glyphs (`demotiles.maplibre.org`). Without
  it the map renders blank/untiled but POI icons + labels still draw.
- **`public/cafe.pmtiles`** must exist. It is committed (~17 MB). If absent:
  `cp ../pipeline/out/cafe.pmtiles public/cafe.pmtiles`.

## Build

```bash
npm install
npm run build
```

`npm run build` prints `Build complete.` and writes `public/vendor/**` and
`public/*.js` (all gitignored).

## Run (agent path) — driver.mjs

```bash
# 4 screenshots (z13/z14/z15/z16) over Tokyo Station -> out/map-z*.png
node .claude/skills/run-cafe-map-web/driver.mjs shots

# one screenshot at an explicit MapLibre hash (#zoom/lat/lng)
node .claude/skills/run-cafe-map-web/driver.mjs shot '#15/35.6812/139.7671' my.png

# click around the view centre until a POI popup opens; prints its text,
# writes out/popup.png
node .claude/skills/run-cafe-map-web/driver.mjs click '#17/35.68123/139.76712'
```

Output goes to `.claude/skills/run-cafe-map-web/out/` (gitignored). **Open
the PNGs and look** — a blank frame means tiles/glyphs didn't load.

Verified output: at z13–z14 only coffee-cup icons draw (no POI name
labels); at z15+ POI labels appear, anchored left of the icon and bumped
above on collision. `click` sweeps a grid until a POI popup opens and
prints e.g.
`POPUP @ 560,380: ドトールコーヒーショップ 八重洲中央口店 ... 信頼度: 0.9984406675100327 https://www.doutor.co.jp/dcs ×`
(store name, brand, address, raw confidence, clickable link).

Each command takes ~40–70 s (build + 8 s settle per view; `KEEP_BUILD=1`
skips the rebuild). `shots` can exceed a 2-minute foreground limit — run it
backgrounded.

Env overrides: `PW_CHROMIUM=/path/to/chrome`, `PORT=8137`, `KEEP_BUILD=1`
(skip rebuild if `public/main.js` exists).

## Run (human path)

```bash
npm run serve   # http://localhost:8080/ , PORT to change
```

Serves `public/` (must be built first). Useless without a browser; the
driver is the headless path.

## Test

```bash
npm test        # node --test ; unit tests for src/chains.js only (27 tests)
```

No E2E tests in the suite — visual behaviour is only checked via the driver.

## Gotchas

- **Chromium needs `libasound.so.2` and this container has no root.** Both
  the full chromium build and `chrome-headless-shell` link it. The driver
  downloads the `.deb` and extracts just the `.so` onto `LD_LIBRARY_PATH`.
  Chromium only uses ALSA for audio, irrelevant to map rendering.
- **Use the full `chromium-*` build, not `chromium_headless_shell-*`.** The
  driver's `resolveChromium()` skips the headless-shell dir on purpose;
  point `executablePath` at `.../chrome-linux64/chrome`.
- **`maplibre-gl` has no usable Node entry.** Its package.json `exports`
  only expose `./dist/*` and there's no `expression` export, so you can't
  unit-test MapLibre style expressions from Node — you must render. That's
  why verification is screenshot-based.
- **No HMR.** After editing `src/`, re-run `npm run build` (or let the
  driver do it) before reloading.
- **Map state is the URL hash** `#zoom/lat/lng` (MapLibre `hash: true`).
  Pass it to `shot`/`click`. No hash → z10 centred on the Imperial Palace,
  too far out to show non-chain POIs or any labels.
- **Non-chain POIs are hidden below z14, labels below z15** — by design. If
  a screenshot looks empty of POIs, check the zoom before suspecting a
  breakage.
- **`out/` and `.libshim/` are gitignored** via the skill dir's own
  `.gitignore`. Don't commit screenshots or the extracted `.so`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `error while loading shared libraries: libasound.so.2` | Driver's auto-fetch didn't run or `archive.ubuntu.com` was unreachable. Run `apt-get download libasound2t64` in `.libshim/_deb/`, `dpkg-deb -x` it, copy `usr/lib/x86_64-linux-gnu/libasound.so.2` to `.libshim/`. |
| `Playwright not found` | `npm install --no-save playwright@1.62.1` |
| `No Chromium build found` | `npx playwright install chromium` |
| Screenshot is a blank / grey frame | No outbound network for OSM tiles + glyphs. Icons/labels still render; basemap won't. |
| `404` for `/cafe.pmtiles`, no POIs at all | `cp ../pipeline/out/cafe.pmtiles public/cafe.pmtiles` |
| `EADDRINUSE` | Another server on `PORT`. Set `PORT=<free>` or `pkill -f server/serve.js`. |

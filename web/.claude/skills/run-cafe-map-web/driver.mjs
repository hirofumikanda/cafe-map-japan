// run-cafe-map-web driver
//
// Builds web/public, serves it with the project's Range-capable static
// server, launches Chromium via Playwright with the workarounds this
// headless container needs, and drives the MapLibre map (screenshots +
// POI popup clicks).
//
// Usage (run from web/):
//   node .claude/skills/run-cafe-map-web/driver.mjs shots
//       -> screenshots at z13/z14/z15/z16 over Tokyo Station into
//          .claude/skills/run-cafe-map-web/out/
//   node .claude/skills/run-cafe-map-web/driver.mjs shot '#15/35.6812/139.7671' foo.png
//   node .claude/skills/run-cafe-map-web/driver.mjs click '#17/35.68123/139.76712'
//       -> clicks around the view centre until a POI popup opens, dumps
//          its text, screenshots it as popup.png
//
// Env overrides: PW_CHROMIUM=/path/to/chrome  PORT=8137  KEEP_BUILD=1

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = path.resolve(SKILL_DIR, "../../..");
const OUT_DIR = path.join(SKILL_DIR, "out");
const require = createRequire(import.meta.url);

// --- 1. resolve Playwright -------------------------------------------------
// Not a dependency of this project. Look in local node_modules first, then
// in npx's cache (npx --no-install playwright populates it), then bail with
// the install command.
function resolvePlaywright() {
  const candidates = [];
  try {
    candidates.push(require.resolve("playwright", { paths: [WEB_DIR] }));
  } catch {}
  const npxCache = path.join(process.env.HOME || "/root", ".npm/_npx");
  if (existsSync(npxCache)) {
    for (const d of readdirSync(npxCache)) {
      const p = path.join(npxCache, d, "node_modules/playwright/index.js");
      if (existsSync(p)) candidates.push(p);
    }
  }
  for (const c of candidates) {
    try {
      return require(c);
    } catch {}
  }
  throw new Error(
    "Playwright not found. From web/ run:\n" +
      "  npm install --no-save playwright@1.62.1\n" +
      "  npx playwright install chromium",
  );
}

// --- 2. resolve a Chromium binary + libasound shim -----------------------
// Playwright's browsers live in ~/.cache/ms-playwright. Both the full
// chromium build and chrome-headless-shell are linked against
// libasound.so.2, which this container lacks. We can't apt-get install
// (no root), but we can download the .deb and extract the .so into a dir
// on LD_LIBRARY_PATH. Chromium only touches ALSA for audio playback, so
// the real library is fine and a never-called path is harmless anyway.
function ensureLibasound() {
  const shimDir = path.join(SKILL_DIR, ".libshim");
  const soPath = path.join(shimDir, "libasound.so.2");
  if (!existsSync(soPath)) {
    console.error("[driver] fetching libasound2 (no root; extract-only)...");
    mkdirSync(shimDir, { recursive: true });
    const tmp = path.join(shimDir, "_deb");
    mkdirSync(tmp, { recursive: true });
    execFileSync("apt-get", ["download", "libasound2t64"], { cwd: tmp, stdio: "inherit" });
    const deb = readdirSync(tmp).find((f) => f.endsWith(".deb"));
    if (!deb) throw new Error("apt-get download libasound2t64 produced no .deb");
    execFileSync("dpkg-deb", ["-x", path.join(tmp, deb), tmp], { stdio: "inherit" });
    execFileSync("cp", [
      path.join(tmp, "usr/lib/x86_64-linux-gnu/libasound.so.2"),
      soPath,
    ]);
  }
  process.env.LD_LIBRARY_PATH = [shimDir, process.env.LD_LIBRARY_PATH]
    .filter(Boolean)
    .join(":");
}

function resolveChromium() {
  if (process.env.PW_CHROMIUM && existsSync(process.env.PW_CHROMIUM)) {
    return process.env.PW_CHROMIUM;
  }
  const root = path.join(process.env.HOME || "/root", ".cache/ms-playwright");
  if (existsSync(root)) {
    for (const d of readdirSync(root).sort().reverse()) {
      if (!d.startsWith("chromium-")) continue; // skip *_headless_shell
      for (const sub of ["chrome-linux64/chrome", "chrome-linux/chrome"]) {
        const p = path.join(root, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error(
    "No Chromium build found. Run: npx playwright install chromium",
  );
}

// --- 3. build + serve ---------------------------------------------------
function build() {
  if (process.env.KEEP_BUILD && existsSync(path.join(WEB_DIR, "public/main.js"))) return;
  execFileSync("npm", ["run", "build"], { cwd: WEB_DIR, stdio: "inherit" });
}

async function startServer() {
  const port = Number(process.env.PORT || 8137);
  const { createServer } = await import(
    path.join(WEB_DIR, "server/serve.js")
  );
  const server = createServer(path.join(WEB_DIR, "public"));
  await new Promise((res) => server.listen(port, res));
  return { server, base: `http://localhost:${port}/` };
}

// --- 4. drive ---------------------------------------------------------
const TOKYO = "35.6812/139.7671";
const IDLE_MS = 8000;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = resolvePlaywright();
  ensureLibasound();
  const executablePath = resolveChromium();
  build();
  const { server, base } = await startServer();
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  page.on("pageerror", (e) => console.error("[pageerror]", e.message));

  const shot = async (hash, file) => {
    await page.goto(base + hash, { waitUntil: "load" });
    await page.waitForTimeout(IDLE_MS);
    const out = path.join(OUT_DIR, file);
    await page.screenshot({ path: out });
    console.error("[driver] wrote", out);
  };

  try {
    if (cmd === "shot") {
      await shot(args[0] || `#15/${TOKYO}`, args[1] || "shot.png");
    } else if (cmd === "click") {
      const hash = args[0] || `#17/35.68123/139.76712`;
      await page.goto(base + hash, { waitUntil: "load" });
      await page.waitForTimeout(IDLE_MS);
      // Sweep a grid around the view centre. POI icons are sparse on
      // screen, so a handful of fixed points misses at some zooms.
      const pts = [];
      for (let y = 260; y <= 640; y += 40) {
        for (let x = 360; x <= 840; x += 40) pts.push([x, y]);
      }
      let hit = false;
      for (const [x, y] of pts) {
        await page.mouse.click(x, y);
        await page.waitForTimeout(120);
        const popup = await page.$(".maplibregl-popup");
        if (popup) {
          const text = (await popup.innerText()).replace(/\s+/g, " ").trim();
          console.log(`POPUP @ ${x},${y}: ${text}`);
          await page.screenshot({ path: path.join(OUT_DIR, "popup.png") });
          console.error("[driver] wrote", path.join(OUT_DIR, "popup.png"));
          hit = true;
          break;
        }
      }
      if (!hit) console.error("[driver] no popup hit - try a denser hash/zoom");
    } else {
      // default: "shots"
      for (const z of ["13", "14", "15", "16"]) {
        await shot(`#${z}/${TOKYO}`, `map-z${z}.png`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

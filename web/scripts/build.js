import { cp, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(ROOT, "src");
const PUBLIC_DIR = path.join(ROOT, "public");
const NODE_MODULES_DIR = path.join(ROOT, "node_modules");

// バンドラを使わず、ブラウザがそのままimportできるESMバンドルをnode_modulesから
// public/vendor/配下へコピーする。maplibre-glのworkerはmaplibre-gl.mjsと同じ
// ディレクトリにある前提で相対URL解決されるため、2ファイルをセットで配置する。
const VENDOR_FILES = [
  ["maplibre-gl/dist/maplibre-gl.mjs", "vendor/maplibre-gl/maplibre-gl.mjs"],
  ["maplibre-gl/dist/maplibre-gl-shared.mjs", "vendor/maplibre-gl/maplibre-gl-shared.mjs"],
  ["maplibre-gl/dist/maplibre-gl-worker.mjs", "vendor/maplibre-gl/maplibre-gl-worker.mjs"],
  ["maplibre-gl/dist/maplibre-gl.css", "vendor/maplibre-gl/maplibre-gl.css"],
  ["pmtiles/dist/index.js", "vendor/pmtiles/index.js"],
];

async function copyVendorAssets() {
  for (const [from, to] of VENDOR_FILES) {
    const src = path.join(NODE_MODULES_DIR, from);
    const dest = path.join(PUBLIC_DIR, to);
    await mkdir(path.dirname(dest), { recursive: true });
    await cp(src, dest);
    console.log(`vendor: ${from} -> public/${to}`);
  }
}

// src/配下のブラウザ実行用スクリプト(*.js、*.test.jsを除く)をpublic/へコピーする。
async function copySourceScripts() {
  const entries = await readdir(SRC_DIR);
  for (const entry of entries) {
    if (!entry.endsWith(".js") || entry.endsWith(".test.js")) {
      continue;
    }
    await cp(path.join(SRC_DIR, entry), path.join(PUBLIC_DIR, entry));
    console.log(`src: src/${entry} -> public/${entry}`);
  }
}

async function main() {
  await copyVendorAssets();
  await copySourceScripts();
  console.log("\nBuild complete.");
}

main().catch((error) => {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
});

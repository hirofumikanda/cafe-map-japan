import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "out");

const MINIMUM_ZOOM = 10;
const MAXIMUM_ZOOM = 14;
const SOURCE_LAYER = "cafe";

// design.md 決定2: tippecanoeで`.pmtiles`を直接出力し、z10-14・source-layer名`cafe`を明示指定する。
function buildTiles({ geojsonPath, pmtilesPath }) {
  const args = [
    `--output=${pmtilesPath}`,
    "--force",
    `--layer=${SOURCE_LAYER}`,
    `--minimum-zoom=${MINIMUM_ZOOM}`,
    `--maximum-zoom=${MAXIMUM_ZOOM}`,
    // spec: GeoJSON中の各POIが変換後もz10-z14の各タイル内にFeatureとして存在しなければならない(SHALL)。
    // タイルサイズ/フィーチャ数上限による間引きに加え、ズームレベルごとの密度ベースの間引き(dot-density
    // drop、デフォルトのdrop-rate=10)も無効化し、POIが失われないようにする。
    "--no-feature-limit",
    "--no-tile-size-limit",
    "--drop-rate=0",
    geojsonPath,
  ];

  const result = spawnSync("tippecanoe", args, { stdio: "inherit" });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(
        "tippecanoe was not found. Install it first (see pipeline/README.md).",
      );
    }
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`tippecanoe exited with status ${result.status}`);
  }
}

function main() {
  const geojsonPath =
    process.env.CAFE_GEOJSON_PATH ?? path.join(OUT_DIR, "cafe.geojson");
  const pmtilesPath =
    process.env.CAFE_PMTILES_PATH ?? path.join(OUT_DIR, "cafe.pmtiles");

  console.log(`Converting ${geojsonPath} -> ${pmtilesPath} (z${MINIMUM_ZOOM}-${MAXIMUM_ZOOM}, layer: ${SOURCE_LAYER})`);
  buildTiles({ geojsonPath, pmtilesPath });
  console.log(`Wrote ${pmtilesPath}`);
}

main();

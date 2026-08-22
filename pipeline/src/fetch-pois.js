import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { queryOverturePlaces } from "./overture-client.js";
import { elementsToFeatures } from "./geojson.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "out");
const OUT_FILE = path.join(OUT_DIR, "cafe.geojson");

// Overture Mapsのリリースバージョン(例: "2025-08-20.0")。未指定の場合はqueryOverturePlaces
// (overture-client.js)がエラーを投げ、不完全なGeoJSONを書き出さずに失敗する。
const OVERTURE_RELEASE = process.env.OVERTURE_RELEASE;

async function main() {
  console.log(
    `Querying Overture Maps Places${OVERTURE_RELEASE ? ` (release ${OVERTURE_RELEASE})` : ""}...`,
  );

  const records = await queryOverturePlaces({ release: OVERTURE_RELEASE });
  const features = elementsToFeatures(records);

  // GeoJSONの書き出しは取得が全て成功した場合のみ行う。取得中に失敗した場合は
  // catch側に処理が移り、不完全なGeoJSONを出力しない。
  const featureCollection = { type: "FeatureCollection", features };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(featureCollection));

  console.log(`\nWrote ${features.length} features to ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(`\nFailed to fetch cafe POIs: ${error.message}`);
  process.exitCode = 1;
});

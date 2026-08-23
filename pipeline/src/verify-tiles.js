import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

import { PbfReader } from "pbf";
import { VectorTile } from "@mapbox/vector-tile";

import { lonLatToTile } from "./tile-math.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "out");

const EXPECTED_MINZOOM = 10;
const EXPECTED_MAXZOOM = 14;
const SOURCE_LAYER = "cafe";
const VERIFY_ZOOM = 14;

function runPmtiles(args) {
  const result = spawnSync("pmtiles", args, { maxBuffer: 1024 * 1024 * 64 });
  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(
        "pmtiles CLI was not found. Install it first (see pipeline/README.md).",
      );
    }
    throw result.error;
  }
  return result;
}

// spec: 生成されたPMTilesアーカイブのメタデータ上のminzoomが10、maxzoomが14として記録される。
function verifyMetadata(pmtilesPath) {
  const result = runPmtiles(["show", "--header-json", pmtilesPath]);
  if (result.status !== 0) {
    throw new Error(`pmtiles show failed: ${result.stderr.toString("utf8")}`);
  }

  const header = JSON.parse(result.stdout.toString("utf8"));
  if (header.minzoom !== EXPECTED_MINZOOM || header.maxzoom !== EXPECTED_MAXZOOM) {
    throw new Error(
      `Unexpected zoom range in ${pmtilesPath}: minzoom=${header.minzoom}, maxzoom=${header.maxzoom} ` +
        `(expected minzoom=${EXPECTED_MINZOOM}, maxzoom=${EXPECTED_MAXZOOM})`,
    );
  }

  console.log(`✓ metadata: minzoom=${header.minzoom}, maxzoom=${header.maxzoom}`);
}

function fetchTileFeatureProperties(pmtilesPath, z, x, y) {
  const result = runPmtiles(["tile", pmtilesPath, String(z), String(x), String(y)]);
  if (result.status !== 0 || result.stdout.length === 0) {
    return [];
  }

  const raw = zlib.gunzipSync(result.stdout);
  const tile = new VectorTile(new PbfReader(raw));
  const layer = tile.layers[SOURCE_LAYER];
  if (!layer) {
    return [];
  }

  const properties = [];
  for (let i = 0; i < layer.length; i++) {
    properties.push(layer.feature(i).properties);
  }
  return properties;
}

// MVTのproperties値はスカラー(string/number/boolean)のみを許容するため、GeoJSON側で
// 配列を持つプロパティ(例: websites)はtippecanoeによりJSON文字列としてタイルへ格納される
// (design.md Decision 1, add-confidence-filter-and-map-controls)。配列側の値との比較では
// タイル側の文字列をパースしてから比較する。
function valuesMatch(actualValue, expectedValue) {
  if (Array.isArray(expectedValue)) {
    let parsedActual;
    try {
      parsedActual = typeof actualValue === "string" ? JSON.parse(actualValue) : actualValue;
    } catch {
      return false;
    }
    return JSON.stringify(parsedActual) === JSON.stringify(expectedValue);
  }
  return actualValue === expectedValue;
}

function propertiesMatch(actual, expected) {
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  if (actualKeys.length !== expectedKeys.length) {
    return false;
  }
  return expectedKeys.every((key) => valuesMatch(actual[key], expected[key]));
}

// spec: GeoJSON中の各POIが、変換後に対応する座標のz14タイル内にFeatureとして存在する。
// (task 3.3: サンプルPOI(既知の座標)がz14タイル内に含まれることを確認する)
function verifySamplePois(pmtilesPath, geojsonPath, sampleSize) {
  const geojson = JSON.parse(readFileSync(geojsonPath, "utf8"));
  const features = geojson.features;
  if (features.length === 0) {
    throw new Error(`No features found in ${geojsonPath}`);
  }

  const count = Math.min(sampleSize, features.length);
  const step = features.length / count;
  const samples = Array.from({ length: count }, (_, i) => features[Math.floor(i * step)]);

  for (const feature of samples) {
    const [lon, lat] = feature.geometry.coordinates;
    const { x, y } = lonLatToTile(lon, lat, VERIFY_ZOOM);
    const label = feature.properties.name ?? feature.id ?? `${lon},${lat}`;

    const tileProperties = fetchTileFeatureProperties(pmtilesPath, VERIFY_ZOOM, x, y);
    const found = tileProperties.some((properties) => propertiesMatch(properties, feature.properties));

    if (!found) {
      throw new Error(
        `Sample POI "${label}" (${lon}, ${lat}) was not found as a Feature in tile z${VERIFY_ZOOM}/${x}/${y}`,
      );
    }

    console.log(`✓ sample POI "${label}" found in tile z${VERIFY_ZOOM}/${x}/${y}`);
  }
}

function main() {
  const pmtilesPath = process.env.CAFE_PMTILES_PATH ?? path.join(OUT_DIR, "cafe.pmtiles");
  const geojsonPath = process.env.CAFE_GEOJSON_PATH ?? path.join(OUT_DIR, "cafe.geojson");
  const sampleSize = Number(process.env.CAFE_VERIFY_SAMPLE_SIZE ?? 5);

  verifyMetadata(pmtilesPath);
  verifySamplePois(pmtilesPath, geojsonPath, sampleSize);
  console.log("\nAll checks passed.");
}

try {
  main();
} catch (error) {
  console.error(`\nVerification failed: ${error.message}`);
  process.exitCode = 1;
}

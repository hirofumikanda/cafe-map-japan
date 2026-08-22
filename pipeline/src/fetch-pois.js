import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PREFECTURES } from "./prefectures.js";
import { queryOverpass } from "./overpass-client.js";
import { elementsToFeatures } from "./geojson.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "out");
const OUT_FILE = path.join(OUT_DIR, "cafe.geojson");

// 公開Overpassインスタンスの利用ポリシーに配慮し、都道府県クエリの間隔を空ける(design.md Risks)。
const REQUEST_INTERVAL_MS = Number(process.env.OVERPASS_REQUEST_INTERVAL_MS ?? 1000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// OVERPASS_PREFECTURES="JP-13,JP-27" のように指定すると対象都道府県を絞り込める(動作確認用)。
// 未指定時は全国47都道府県を対象にする。
function resolvePrefectures() {
  const filter = process.env.OVERPASS_PREFECTURES;
  if (!filter) {
    return PREFECTURES;
  }

  const codes = new Set(filter.split(",").map((code) => code.trim()));
  const selected = PREFECTURES.filter((prefecture) => codes.has(prefecture.code));
  if (selected.length === 0) {
    throw new Error(`OVERPASS_PREFECTURES did not match any known prefecture code: ${filter}`);
  }
  return selected;
}

async function main() {
  const prefectures = resolvePrefectures();
  const allFeatures = [];

  for (const [index, prefecture] of prefectures.entries()) {
    process.stdout.write(
      `[${index + 1}/${prefectures.length}] Fetching ${prefecture.name} (${prefecture.code})... `,
    );
    const elements = await queryOverpass(prefecture);
    const features = elementsToFeatures(elements);
    allFeatures.push(...features);
    console.log(`${features.length} POIs`);

    if (index < prefectures.length - 1) {
      await sleep(REQUEST_INTERVAL_MS);
    }
  }

  // 全都道府県の取得が成功した場合のみファイルを書き出す。
  // 途中で失敗した場合は catch 側に処理が移り、不完全なGeoJSONを出力しない。
  const featureCollection = { type: "FeatureCollection", features: allFeatures };
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(featureCollection));
  console.log(`\nWrote ${allFeatures.length} features to ${OUT_FILE}`);
}

main().catch((error) => {
  console.error(`\nFailed to fetch cafe POIs: ${error.message}`);
  process.exitCode = 1;
});

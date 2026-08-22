import { spawn } from "node:child_process";

export class OvertureFetchError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "OvertureFetchError";
  }
}

// 日本を覆う矩形bbox(概ね経度122〜154、緯度20〜46)。Overtureの行政境界ポリゴンによる
// 厳密な絞り込みは行わず、bboxで一次絞り込みしたうえでaddresses.countryが"JP"のレコードに
// 限定する(design.md Decision 2)。
export const JAPAN_BBOX = { minLon: 122, maxLon: 154, minLat: 20, maxLat: 46 };

// OSMのamenity=cafe相当として扱うOverture Placesのカテゴリ(design.md Decision 3)。
export const CAFE_CATEGORIES = ["cafe", "coffee_shop"];

export const MIN_CONFIDENCE = 0.9;

// theme=places, type=placeのOverture Placesデータ(GeoParquet)に対し、bbox・カテゴリ・
// confidenceの条件を一度に適用するSQLを組み立てる(design.md Decision 1)。
// `release`はOverture Mapsのリリースバージョン(例: "2025-08-20.0")で、日付とともに
// 更新されるため呼び出し元(環境変数OVERTURE_RELEASE等)で明示的に指定する。
export function buildQuery({
  release,
  bbox = JAPAN_BBOX,
  categories = CAFE_CATEGORIES,
  minConfidence = MIN_CONFIDENCE,
} = {}) {
  if (!release) {
    throw new Error("buildQuery requires a `release` (Overture Maps release version, e.g. \"2025-08-20.0\")");
  }

  const categoryList = categories.map((category) => `'${category}'`).join(", ");

  // names/categories/brand/addressesはSTRUCT/LIST型で、duckdb CLIの`-json`出力は
  // これらを素のままSELECTすると有効なJSONにならない非JSON文字列(Python風のdict/list表記)
  // として出力してしまう。to_json()で明示的にJSON化することで、execDuckDbが行全体を
  // JSON.parseした際にこれらの列も正しくネストしたオブジェクト/配列として得られる。
  return `INSTALL spatial; LOAD spatial;
INSTALL httpfs; LOAD httpfs;
SET s3_region='us-west-2';

SELECT
  id,
  to_json(names) AS names,
  to_json(categories) AS categories,
  to_json(brand) AS brand,
  to_json(addresses) AS addresses,
  confidence,
  ST_AsGeoJSON(geometry) AS geometry
FROM read_parquet(
  's3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*',
  filename = true,
  hive_partitioning = 1
)
WHERE bbox.xmin BETWEEN ${bbox.minLon} AND ${bbox.maxLon}
  AND bbox.ymin BETWEEN ${bbox.minLat} AND ${bbox.maxLat}
  AND categories.primary IN (${categoryList})
  AND confidence >= ${minConfidence};`;
}

// duckdb CLIをサブプロセスとして呼び出し、`-json`出力を行のJSON配列としてパースする。
// tippecanoe(build-tiles.js)・curl(overpass-client.js)と同じ「外部CLIをサブプロセスで
// 呼ぶ」パターン(design.md Decision 1)。
function execDuckDb(query) {
  return new Promise((resolve, reject) => {
    const child = spawn("duckdb", ["-json", "-c", query]);
    const stdoutChunks = [];
    let stderr = "";

    child.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(new Error("duckdb was not found. Install it first (see pipeline/README.md)."));
        return;
      }
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`duckdb exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      const output = Buffer.concat(stdoutChunks).toString("utf8").trim();
      if (!output) {
        resolve([]);
        return;
      }

      try {
        resolve(JSON.parse(output));
      } catch (error) {
        reject(new Error(`Failed to parse duckdb JSON output: ${error.message}`));
      }
    });
  });
}

// ST_AsGeoJSONはVARCHARを返すため、geometry列をGeoJSON geometryオブジェクトへ復元する。
function parseRecord(row) {
  return {
    ...row,
    geometry: typeof row.geometry === "string" ? JSON.parse(row.geometry) : row.geometry,
  };
}

// addresses配列に国コード"JP"を含むレコードのみを対象にする。addressesを持たない
// レコードはbboxのみでは国外分を誤って含む可能性があるため対象外とする(design.md Decision 2)。
function hasJapanAddress(record) {
  return Array.isArray(record.addresses) && record.addresses.some((address) => address?.country === "JP");
}

// Overture Maps Placesから、日本国内・confidence >= 0.9のカフェ・喫茶店レコードを取得する。
export async function queryOverturePlaces(options = {}) {
  const {
    release,
    bbox = JAPAN_BBOX,
    categories = CAFE_CATEGORIES,
    minConfidence = MIN_CONFIDENCE,
    execImpl = execDuckDb,
  } = options;

  const query = buildQuery({ release, bbox, categories, minConfidence });

  let rows;
  try {
    rows = await execImpl(query);
  } catch (error) {
    throw new OvertureFetchError(`Failed to query Overture Maps Places: ${error.message}`, { cause: error });
  }

  if (!Array.isArray(rows)) {
    throw new OvertureFetchError("duckdb response was not a JSON array of records");
  }

  return rows.map(parseRecord).filter(hasJapanAddress);
}

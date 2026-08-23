import { test } from "node:test";
import assert from "node:assert/strict";

import { buildQuery, queryOverturePlaces, OvertureFetchError } from "./overture-client.js";

const RELEASE = "2025-08-20.0";

function cafeRow(overrides = {}) {
  return {
    id: "overture:place:1",
    names: { primary: "ドトールコーヒーショップ 新宿店" },
    categories: { primary: "coffee_shop", alternate: [] },
    brand: { names: { primary: "ドトールコーヒーショップ" } },
    addresses: [{ freeform: "新宿1-1-1", country: "JP" }],
    confidence: 0.95,
    geometry: JSON.stringify({ type: "Point", coordinates: [139.7, 35.69] }),
    ...overrides,
  };
}

test("buildQuery requires a release", () => {
  assert.throws(() => buildQuery({}), /requires a `release`/);
});

test("buildQuery scopes the query to theme=places/type=place for the given release", () => {
  const query = buildQuery({ release: RELEASE });
  assert.match(query, /release\/2025-08-20\.0\/theme=places\/type=place/);
});

test("buildQuery applies the Japan bbox, cafe categories, and confidence conditions", () => {
  const query = buildQuery({ release: RELEASE });
  assert.match(query, /bbox\.xmin BETWEEN 122 AND 154/);
  assert.match(query, /bbox\.ymin BETWEEN 20 AND 46/);
  assert.match(query, /categories\.primary IN \('cafe', 'coffee_shop'\)/);
  assert.match(query, /confidence >= 0\.9/);
});

// duckdb CLIの`-json`出力は、STRUCT/LIST列を素のままSELECTすると非JSON文字列
// (Python風のdict/list表記)になり、addresses等が配列として得られなくなる
// (実データで確認済みのバグ)。to_json()で明示的にラップされていることを検証する。
test("buildQuery wraps struct/list columns in to_json() for valid nested JSON output", () => {
  const query = buildQuery({ release: RELEASE });
  assert.match(query, /to_json\(names\) AS names/);
  assert.match(query, /to_json\(categories\) AS categories/);
  assert.match(query, /to_json\(brand\) AS brand/);
  assert.match(query, /to_json\(addresses\) AS addresses/);
  assert.match(query, /to_json\(websites\) AS websites/);
});

test("queryOverturePlaces returns records with parsed GeoJSON geometry", async () => {
  const execImpl = async () => [cafeRow()];

  const records = await queryOverturePlaces({ release: RELEASE, execImpl });

  assert.equal(records.length, 1);
  assert.deepEqual(records[0].geometry, { type: "Point", coordinates: [139.7, 35.69] });
  assert.equal(records[0].names.primary, "ドトールコーヒーショップ 新宿店");
});

test("queryOverturePlaces returns records with the websites column", async () => {
  const execImpl = async () => [cafeRow({ websites: ["https://example.com/doutor-shinjuku"] })];

  const records = await queryOverturePlaces({ release: RELEASE, execImpl });

  assert.deepEqual(records[0].websites, ["https://example.com/doutor-shinjuku"]);
});

test("queryOverturePlaces excludes records without a JP address", async () => {
  const execImpl = async () => [
    cafeRow({ id: "jp", addresses: [{ freeform: "新宿1-1-1", country: "JP" }] }),
    cafeRow({ id: "no-country", addresses: [{ freeform: "unknown" }] }),
    cafeRow({ id: "foreign", addresses: [{ freeform: "somewhere", country: "US" }] }),
    cafeRow({ id: "no-addresses", addresses: undefined }),
  ];

  const records = await queryOverturePlaces({ release: RELEASE, execImpl });

  assert.deepEqual(
    records.map((record) => record.id),
    ["jp"],
  );
});

test("queryOverturePlaces wraps execImpl failures in OvertureFetchError", async () => {
  const execImpl = async () => {
    throw new Error("duckdb exited with code 1");
  };

  await assert.rejects(() => queryOverturePlaces({ release: RELEASE, execImpl }), OvertureFetchError);
});

test("queryOverturePlaces rejects a non-array duckdb response", async () => {
  const execImpl = async () => ({ not: "an array" });

  await assert.rejects(() => queryOverturePlaces({ release: RELEASE, execImpl }), OvertureFetchError);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import { elementsToFeatures } from "./geojson.js";

test("converts Overture Places records into Point features and keeps name/brand attributes", () => {
  const records = [
    {
      id: "overture:place:doutor-shinjuku",
      names: { primary: "ドトールコーヒーショップ 新宿東口店" },
      categories: { primary: "coffee_shop", alternate: [] },
      brand: { names: { primary: "ドトールコーヒー" } },
      addresses: [{ freeform: "新宿1-1-1", country: "JP" }],
      confidence: 0.95,
      geometry: { type: "Point", coordinates: [139.6917, 35.6895] },
    },
    {
      id: "overture:place:kissa-guran",
      names: { primary: "喫茶ぐらん" },
      categories: { primary: "cafe", alternate: [] },
      addresses: [{ freeform: "大阪市北区1-1", country: "JP" }],
      confidence: 0.92,
      geometry: { type: "Point", coordinates: [135.5023, 34.6937] },
    },
    {
      // 座標を解決できないレコードはスキップされる
      id: "overture:place:no-geometry",
      names: { primary: "座標なしPOI" },
      categories: { primary: "cafe", alternate: [] },
      addresses: [{ freeform: "unknown", country: "JP" }],
      confidence: 0.93,
      geometry: null,
    },
  ];

  const features = elementsToFeatures(records);

  assert.equal(features.length, 2);

  assert.equal(features[0].id, "overture:place:doutor-shinjuku");
  assert.deepEqual(features[0].geometry, {
    type: "Point",
    coordinates: [139.6917, 35.6895],
  });
  assert.equal(features[0].properties.name, "ドトールコーヒーショップ 新宿東口店");
  assert.equal(features[0].properties.brand, "ドトールコーヒー");
  assert.equal(features[0].properties.operator, undefined);
  assert.equal(features[0].properties.address, "新宿1-1-1");

  assert.equal(features[1].id, "overture:place:kissa-guran");
  assert.deepEqual(features[1].geometry, {
    type: "Point",
    coordinates: [135.5023, 34.6937],
  });
  assert.equal(features[1].properties.name, "喫茶ぐらん");
  assert.equal(features[1].properties.address, "大阪市北区1-1");
});

test("omits the address property when the record has no addresses", () => {
  const records = [
    {
      id: "overture:place:no-address",
      names: { primary: "住所不明のカフェ" },
      categories: { primary: "cafe", alternate: [] },
      addresses: [],
      confidence: 0.9,
      geometry: { type: "Point", coordinates: [135.7681, 35.0116] },
    },
    {
      id: "overture:place:undefined-addresses",
      names: { primary: "addresses未定義のカフェ" },
      categories: { primary: "cafe", alternate: [] },
      confidence: 0.9,
      geometry: { type: "Point", coordinates: [135.77, 35.02] },
    },
  ];

  const features = elementsToFeatures(records);

  assert.equal(features.length, 2);
  assert.equal("address" in features[0].properties, false);
  assert.equal("address" in features[1].properties, false);
});

test("omits the brand property when the record has no brand", () => {
  const records = [
    {
      id: "overture:place:no-brand",
      names: { primary: "個人経営のカフェ" },
      categories: { primary: "cafe", alternate: [] },
      addresses: [{ freeform: "京都市中京区1-1", country: "JP" }],
      confidence: 0.9,
      geometry: { type: "Point", coordinates: [135.7681, 35.0116] },
    },
  ];

  const features = elementsToFeatures(records);

  assert.equal(features.length, 1);
  assert.equal(features[0].properties.name, "個人経営のカフェ");
  assert.equal("brand" in features[0].properties, false);
});

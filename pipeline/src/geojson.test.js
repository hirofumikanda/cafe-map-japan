import { test } from "node:test";
import assert from "node:assert/strict";

import { elementsToFeatures } from "./geojson.js";

test("converts node/way elements into Point features and keeps brand/operator/name tags", () => {
  const elements = [
    {
      type: "node",
      id: 1,
      lat: 35.6895,
      lon: 139.6917,
      tags: {
        amenity: "cafe",
        name: "ドトールコーヒーショップ 新宿東口店",
        brand: "ドトールコーヒー",
        operator: "株式会社ドトールコーヒー",
      },
    },
    {
      type: "way",
      id: 2,
      center: { lat: 34.6937, lon: 135.5023 },
      tags: { amenity: "cafe", name: "喫茶ぐらん" },
    },
    {
      // 座標を解決できない要素はスキップされる
      type: "node",
      id: 3,
      tags: { amenity: "cafe", name: "座標なしPOI" },
    },
  ];

  const features = elementsToFeatures(elements);

  assert.equal(features.length, 2);

  assert.equal(features[0].id, "node/1");
  assert.deepEqual(features[0].geometry, {
    type: "Point",
    coordinates: [139.6917, 35.6895],
  });
  assert.equal(features[0].properties.brand, "ドトールコーヒー");
  assert.equal(features[0].properties.operator, "株式会社ドトールコーヒー");
  assert.equal(features[0].properties.name, "ドトールコーヒーショップ 新宿東口店");

  assert.equal(features[1].id, "way/2");
  assert.deepEqual(features[1].geometry, {
    type: "Point",
    coordinates: [135.5023, 34.6937],
  });
});

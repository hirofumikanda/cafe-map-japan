import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAIN_TABLE,
  GENERIC_CAFE_ICON_ID,
  buildIconImageExpression,
  normalizeChainText,
  resolveChainIconId,
} from "./chains.js";

test("normalizeChainText trims and NFKC-normalizes full-width/half-width variants", () => {
  assert.equal(normalizeChainText("  ドトールコーヒー  "), "ドトールコーヒー");
  // 半角カタカナ -> NFKCで全角カタカナへ正規化される
  assert.equal(normalizeChainText("ﾄﾞﾄｰﾙｺｰﾋｰ"), "ドトールコーヒー");
});

test("normalizeChainText strips common corporate-entity notations", () => {
  assert.equal(normalizeChainText("株式会社ドトールコーヒー"), "ドトールコーヒー");
  assert.equal(normalizeChainText("ドトールコーヒー（株）"), "ドトールコーヒー");
});

test("normalizeChainText returns an empty string for missing values", () => {
  assert.equal(normalizeChainText(undefined), "");
  assert.equal(normalizeChainText(null), "");
  assert.equal(normalizeChainText(""), "");
});

test("resolveChainIconId matches a known chain via the brand tag", () => {
  const iconId = resolveChainIconId({ brand: "ドトールコーヒー", name: "ドトールコーヒーショップ 八重洲店" });
  assert.equal(iconId, "chain-doutor");
});

test("resolveChainIconId matches store-type variants via partial match", () => {
  const iconId = resolveChainIconId({ brand: "ドトールコーヒーショップ" });
  assert.equal(iconId, "chain-doutor");
});

test("resolveChainIconId matches a known chain via operator when brand is absent", () => {
  const iconId = resolveChainIconId({ operator: "カフェ・ベローチェ" });
  assert.equal(iconId, "chain-veloce");
});

test("resolveChainIconId matches despite half-width katakana and corporate suffixes", () => {
  const iconId = resolveChainIconId({ brand: "株式会社ﾄﾞﾄｰﾙｺｰﾋｰ" });
  assert.equal(iconId, "chain-doutor");
});

test("resolveChainIconId falls back to the generic icon for unclassified POIs", () => {
  const iconId = resolveChainIconId({ name: "喫茶ふらっと" });
  assert.equal(iconId, GENERIC_CAFE_ICON_ID);
});

test("resolveChainIconId falls back to the generic icon when no properties are given", () => {
  assert.equal(resolveChainIconId({}), GENERIC_CAFE_ICON_ID);
});

test("buildIconImageExpression produces a case expression ending in the generic icon", () => {
  const expression = buildIconImageExpression();
  assert.equal(expression[0], "case");
  assert.equal(expression.at(-1), GENERIC_CAFE_ICON_ID);
  // 各チェーン分の [condition, iconId] ペア + 先頭"case" + 末尾フォールバック
  assert.equal(expression.length, 1 + CHAIN_TABLE.length * 2 + 1);
});

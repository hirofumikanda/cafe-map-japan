import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAIN_FILTER_OPTIONS,
  CHAIN_TABLE,
  GENERIC_CAFE_ICON_ID,
  buildChainIdExpression,
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

test("resolveChainIconId matches Starbucks via its common abbreviation", () => {
  const iconId = resolveChainIconId({ brand: "スタバ" });
  assert.equal(iconId, "chain-starbucks");
});

test("resolveChainIconId matches Komeda Coffee via brand", () => {
  const iconId = resolveChainIconId({ brand: "コメダ珈琲店" });
  assert.equal(iconId, "chain-komeda");
});

test("resolveChainIconId matches Tully's Coffee via brand", () => {
  const iconId = resolveChainIconId({ brand: "タリーズコーヒー" });
  assert.equal(iconId, "chain-tullys");
});

test("resolveChainIconId matches Saint Marc Cafe via brand", () => {
  const iconId = resolveChainIconId({ brand: "サンマルクカフェ" });
  assert.equal(iconId, "chain-sanmarc");
});

test("resolveChainIconId matches Excelsior Caffe despite full/half-width spacing differences", () => {
  const iconId = resolveChainIconId({ brand: "エクセルシオール　カフェ" });
  assert.equal(iconId, "chain-excelsior");
});

test("resolveChainIconId matches Ueshima Coffee via brand", () => {
  const iconId = resolveChainIconId({ brand: "上島珈琲店" });
  assert.equal(iconId, "chain-ueshima");
});

test("resolveChainIconId matches Ginza Renoir via brand", () => {
  const iconId = resolveChainIconId({ brand: "銀座ルノアール" });
  assert.equal(iconId, "chain-renoir");
});

test("resolveChainIconId matches BECK'S COFFEE SHOP via its short name", () => {
  const iconId = resolveChainIconId({ brand: "ベックスコーヒーショップ" });
  assert.equal(iconId, "chain-becks");
});

test("buildIconImageExpression produces a case expression ending in the generic icon", () => {
  const expression = buildIconImageExpression();
  assert.equal(expression[0], "case");
  assert.equal(expression.at(-1), GENERIC_CAFE_ICON_ID);
  // 各チェーン分の [condition, iconId] ペア + 先頭"case" + 末尾フォールバック
  assert.equal(expression.length, 1 + CHAIN_TABLE.length * 2 + 1);
});

test("buildChainIdExpression produces a case expression ending in an empty string", () => {
  const expression = buildChainIdExpression();
  assert.equal(expression[0], "case");
  assert.equal(expression.at(-1), "");
  // 各チェーン分の [condition, id] ペア + 先頭"case" + 末尾フォールバック
  assert.equal(expression.length, 1 + CHAIN_TABLE.length * 2 + 1);
});

test("buildChainIdExpression returns chain ids in CHAIN_TABLE order", () => {
  const expression = buildChainIdExpression();
  const ids = expression.slice(1, -1).filter((_, index) => index % 2 === 1);
  assert.deepEqual(ids, CHAIN_TABLE.map((chain) => chain.id));
});

test("CHAIN_FILTER_OPTIONS starts with the all option followed by every chain", () => {
  assert.deepEqual(CHAIN_FILTER_OPTIONS[0], { value: "all", label: "すべて" });
  assert.equal(CHAIN_FILTER_OPTIONS.length, CHAIN_TABLE.length + 1);
  assert.deepEqual(
    CHAIN_FILTER_OPTIONS.slice(1),
    CHAIN_TABLE.map((chain) => ({ value: chain.id, label: chain.label })),
  );
});

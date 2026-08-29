## 1. chains.js: チェーン判定ロジックの共通化

<!-- GitHub Issue: #76 (## 1, ## 2 を1 Issueに統合) -->

- [x] 1.1 `web/src/chains.js` に、チェーンごとの `matchKeys` 部分一致条件を組み立てる共通ヘルパー(例: `chainMatchCondition(chain)`)と共有の `searchText` 定義を切り出す(design.md Decision 1)。
- [x] 1.2 `buildIconImageExpression()` を 1.1 のヘルパーを使う形にリファクタする。返り値の構造(`["case", <条件, iconId>..., GENERIC_CAFE_ICON_ID]`)と評価順(`CHAIN_TABLE` 順)は変更しない。
- [x] 1.3 一致したチェーンの `id` を返し、非一致時は空文字列 `""` を返す `["case", ...]` 式ビルダー `buildChainIdExpression()` を追加・エクスポートする(design.md Decision 1)。
- [x] 1.4 プルダウン選択肢 `CHAIN_FILTER_OPTIONS`(先頭 `{ value: "all", label: "すべて" }`、以降 `CHAIN_TABLE` から `{ value: id, label: label }` を導出)を追加・エクスポートする(design.md Decision 5)。

## 2. chains.test.js: ユニットテスト追加

<!-- GitHub Issue: #76 -->

- [x] 2.1 `buildChainIdExpression()` が `["case"]` で始まり、末尾フォールバックが `""`、長さが `1 + CHAIN_TABLE.length * 2 + 1` であることを検証するテストを追加する。
- [x] 2.2 `CHAIN_FILTER_OPTIONS` の先頭が `{ value: "all", label: "すべて" }` で、以降が `CHAIN_TABLE` と同数・同順の `{ value, label }` であることを検証するテストを追加する。
- [x] 2.3 既存テスト(特に `buildIconImageExpression produces a case expression ending in the generic icon`)がリファクタ後も通ることを `cd web && npm test` で確認する。

## 3. main.js: カフェレイヤのフィルタ合成

<!-- GitHub Issue: #77 -->

- [x] 3.1 `buildCafeFilter(selectedValue)` を実装する。`"all"` 選択時は `["all", CAFE_CONFIDENCE_FILTER, ["any", ["!=", chainIdExpr, ""], [">=", ["zoom"], 14]]]`、特定チェーン選択時は `["all", CAFE_CONFIDENCE_FILTER, ["==", chainIdExpr, selectedValue]]` を返す(design.md Decision 2)。`chainIdExpr` は `buildChainIdExpression()`。
- [x] 3.2 `map.on("load")` 内のレイヤ追加で、`filter` に `buildCafeFilter("all")` を渡すよう変更する(`CAFE_CONFIDENCE_FILTER` 直接指定を置き換え)。
- [x] 3.3 選択値を受け取って `map.setFilter(CAFE_LAYER_ID, buildCafeFilter(value))` を呼ぶ適用関数(例: `applyChainFilter(value)`)を実装する。

## 4. main.js / index.html: プルダウンコントロール

<!-- GitHub Issue: #78 -->

- [x] 4.1 MapLibre `IControl` を実装するチェーン絞り込みコントロール(`onAdd` で `<div class="maplibregl-ctrl chain-filter-ctrl">` + 視覚的に隠した `<label>` + `<select>` を生成)を追加する(design.md Decision 3)。
- [x] 4.2 `<select>` の `<option>` を `CHAIN_FILTER_OPTIONS` から生成し、初期選択値を `"all"` にする。`change` イベントで `applyChainFilter(select.value)` を呼ぶ。
- [x] 4.3 コントロールコンテナで `mousedown` / `dblclick` / `wheel` / `touchstart` の伝播を停止し、地図ジェスチャと干渉させない(design.md Decision 3)。
- [x] 4.4 `map.addControl(new ChainFilterControl(...), "top-left")` を `NavigationControl` の追加付近で登録する。
- [x] 4.5 `web/public/index.html` の `<style>` に `.chain-filter-ctrl` / `.chain-filter-ctrl select` のカスタムスタイル(`appearance: none`、角丸、ボーダー/シャドウ、SVGシェブロン、`min-height: 40px`、`font-size: 16px`、`:focus-visible` リング、ホバー状態、視覚的に隠す `.visually-hidden` ラベル)を追加する(design.md Decision 4)。

## 5. ビルドと動作確認

<!-- GitHub Issue: #79 -->

- [ ] 5.1 `cd web && npm run build` で `src/` の変更が `public/` に反映されることを確認する。
- [ ] 5.2 `cd web && npm test` で全テストが通ることを確認する。
- [ ] 5.3 ローカル配信(`web/README.md` 参照)で、プルダウン「すべて」時に z10〜13 ではチェーン店のみ、z14 以上でチェーン店以外も表示されることをブラウザで確認する。
- [ ] 5.4 特定チェーン(例: スターバックス コーヒー)選択時に当該チェーンのPOIのみ表示され、z10〜13 でも表示されること、「すべて」に戻すと元の条件に戻ることを確認する。
- [ ] 5.5 プルダウンが地図左上に表示され、PC(クリック)・スマホエミュレーション(タッチ)双方で開閉・選択でき、地図のドラッグ/ズームを妨げないことを確認する。
- [ ] 5.6 いずれの選択状態でも confidence しきい値フィルタが維持されている(z15 で 0.97 未満が出ない)ことを確認する。

## 1. tippecanoeオプションの修正 (Issue #36)

- [x] 1.1 `pipeline/src/build-tiles.js`のtippecanoe呼び出し引数に`--drop-rate=0`を追加する

## 2. 実データでの検証 (Issue #36)

- [x] 2.1 ローカルで`npm run build:tiles`相当を実行し、`--drop-rate=0`を反映した`cafe.pmtiles`を再生成する
- [x] 2.2 `npm run verify:tiles`(または既存の検証スクリプト)を実行し、z10-z14の各ズームレベルでGeoJSON中の全POIがタイル内にFeatureとして存在することを確認する

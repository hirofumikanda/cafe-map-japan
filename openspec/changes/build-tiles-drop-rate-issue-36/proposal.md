## Why

`pipeline/src/build-tiles.js`のtippecanoe呼び出しは`--no-feature-limit`・`--no-tile-size-limit`でタイルサイズ/フィーチャ数上限による間引きを無効化しているが、ズームレベルごとの密度ベースの間引き(dot-density drop)を制御する`--drop-rate`は未指定でデフォルト値(10)が適用されている。そのため、z10-13の低ズームレベルではPOIが間引かれる可能性があり、既存spec([cafe-poi-pipeline](../../specs/cafe-poi-pipeline/spec.md))が保証する「全POIがいずれかのタイルに含まれる」という要件をz14未満のズームレベルでも満たすべきという意図に反する(Issue #36)。

## What Changes

- `pipeline/src/build-tiles.js`のtippecanoe呼び出し引数に`--drop-rate=0`を追加し、密度ベースの間引きを無効化する。
- 既存の「全POIがいずれかのタイルに含まれる」というPMTiles変換要件を、z14タイルだけでなくz10-z14の全ズームレベルでPOIが失われないことを明示する内容に拡張する。
- 実データ(`out/cafe.geojson`)を用いて、生成された`cafe.pmtiles`の各ズームレベルでPOIが間引かれていないことを確認する。

## Capabilities

### New Capabilities
(なし)

### Modified Capabilities
- `cafe-poi-pipeline`: 「GeoJSONからPMTilesへの変換」要件のうち、POI保持の保証範囲をz14タイルのみからz10-z14の全ズームレベルへ拡張する。

## Impact

- `pipeline/src/build-tiles.js`(tippecanoe呼び出し引数)
- `openspec/specs/cafe-poi-pipeline/spec.md`(該当要件のシナリオ更新)
- `pipeline/out/cafe.pmtiles`(再生成対象、既存の検証スクリプト`npm run verify:tiles`で確認)

## Why

現在のPMTilesはconfidence>=0.9で一次フィルタ済みのPOIを一律に表示しており、ズームが低い(広域表示の)段階でも信頼度の低いPOIまで表示されるため、密集地では誤検出っぽいPOIが目立つ。またタイルに`confidence`・`websites`が含まれないため、クライアント側で信頼度に応じた表示調整や公式サイトへのリンク表示ができない。加えて地図の操作性(ズーム/回転コントロール)や表示位置の共有(URLでの位置復元)にも不足がある。

## What Changes

- パイプラインが生成するGeoJSON/PMTilesのFeature propertiesに`confidence`(数値)と`websites`(Overture Placesの`websites`相当)を追加する。
- ビューアのカフェレイヤに、ズームレベルに応じた`confidence`しきい値フィルタを適用する:
  - z10-14: `confidence >= 0.99`
  - z15: `confidence >= 0.97`
  - z16: `confidence >= 0.95`
  - z17以上: `confidence >= 0.90`(パイプラインの最小しきい値のため実質全件)
- 地図右上にMapLibreのNavigationControl(ズーム・回転・傾き操作)を追加する。
- 地図の表示位置・ズーム・向きをURLハッシュへ同期する(MapLibreの`hash`オプション)。
- 背景地図(OSMラスタ)の透過度を0.50にする。
- カフェレイヤのPOIシンボルにラベル(店名等)をテキストとして表示する。配置はアイコンの右を優先し、収まらない場合はアイコンの下にフォールバックする(MapLibreの`text-variable-anchor`)。グリフフォントは`https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf`のNoto Sans Regularを使用する。ラベル追加に合わせてアイコンサイズを少し縮小する。
- POIクリック時のポップアップに`confidence`(信頼度)と`websites`(公式サイトへのリンク)を追加表示する。
- 地図上にカフェ・喫茶店POIデータの出典であるOverture Maps Foundationへの帰属表示(attribution)を追加する。

## Capabilities

### Modified Capabilities
- `cafe-poi-pipeline`: 取得・変換するPOIのpropertiesに`confidence`・`websites`を含めるよう要件を追加する。
- `cafe-map-viewer`: POIシンボルレイヤの表示要件にズーム連動のconfidenceフィルタを追加し、地図操作(ナビゲーションコントロール)とURL状態同期(ハッシュ)の要件を新設する。

## Impact

- `pipeline/src/geojson.js`: `elementsToFeatures`が`confidence`・`websites`をpropertiesへ含めるよう変更。
- `pipeline/src/overture-client.js`: DuckDBクエリのSELECT列に`websites`を追加(`confidence`は既存)。
- `pipeline/src/geojson.test.js`: 新規propertiesのテストケースを追加。
- `web/src/main.js`: カフェレイヤに`filter`式(zoom + confidence)を追加、`NavigationControl`を`top-right`に追加、`MapLibreMap`初期化オプションに`hash: true`を追加。
- `web/src/main.js`: スタイルに`glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"`を追加、`osm`レイヤに`paint.raster-opacity: 0.5`を追加、カフェレイヤのlayoutに`text-field`/`text-font`/`text-variable-anchor`/`text-radial-offset`を追加し、`icon-size`を縮小。
- `web/src/main.js`: `buildCafePopupHtml`が`confidence`(百分率表示)と`websites`(http/https URLへのリンク)をポップアップに追加表示するよう変更。
- `web/src/main.js`: カフェベクタソース(`CAFE_SOURCE_ID`)に`attribution`としてOverture Maps Foundationへのクレジットを追加。
- 既存のPMTiles(`web/public/cafe.pmtiles`、`pipeline/out/cafe.pmtiles`)は再生成が必要(`confidence`/`websites`を含む新しいtippecanoe出力に置き換わる)。
- 新規の外部依存として、グリフ配信元`https://demotiles.maplibre.org`への実行時アクセスが加わる。

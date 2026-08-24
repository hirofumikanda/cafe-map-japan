## 1. パイプライン: confidence・websitesの取得 (Issue #45)

- [x] 1.1 `pipeline/src/overture-client.js`のクエリSELECT列に`to_json(websites) AS websites`を追加する(design.md Decision 2)。
- [x] 1.2 `pipeline/src/overture-client.test.js`に`websites`列がクエリ・レスポンスに含まれることを確認するテストを追加する。

## 2. パイプライン: GeoJSON propertiesへの反映 (Issue #46)

- [x] 2.1 `pipeline/src/geojson.js`の`elementsToFeatures`で、`record.confidence`を`properties.confidence`として保持する。
- [x] 2.2 `pipeline/src/geojson.js`の`elementsToFeatures`で、`record.websites`が存在する場合に`properties.websites`として(配列のまま)保持し、存在しない場合はpropertyを省略する(design.md Decision 1)。
- [x] 2.3 `pipeline/src/geojson.test.js`に、confidenceが保持されるケース・websitesが保持されるケース・websites不在時に省略されるケースのテストを追加する。

## 3. パイプラインの再実行とタイル再生成 (Issue #47)

- [x] 3.1 `OVERTURE_RELEASE`を指定して`npm run fetch`を実行し、`confidence`・`websites`を含む`pipeline/out/cafe.geojson`を再生成する。
- [x] 3.2 `npm run build:tiles`を実行し、`pipeline/out/cafe.pmtiles`を再生成する。
- [x] 3.3 `npm run verify:tiles`で再生成したPMTilesを検証する。
- [x] 3.4 再生成した`cafe.pmtiles`を`web/public/cafe.pmtiles`へ反映する。

## 4. ビューア: ズーム連動confidenceフィルタ (Issue #48)

- [x] 4.1 `web/src/main.js`のカフェレイヤ(`CAFE_LAYER_ID`)に、`["step", ["zoom"], 0.99, 15, 0.97, 16, 0.95, 17, 0.90]`としきい値比較を組み合わせた`filter`式を追加する(design.md Decision 3)。
- [x] 4.2 z10-14/z15/z16/z17以上の各ズーム帯でconfidenceしきい値未満のPOIが表示されないことを、ローカルサーバー上のブラウザ確認で検証する。

## 5. ビューア: ナビゲーションコントロールとURLハッシュ (Issue #49)

- [x] 5.1 `web/src/main.js`で`NavigationControl`をmaplibre-glからインポートし、`map.addControl(new NavigationControl(), "top-right")`を追加する(design.md Decision 4)。
- [x] 5.2 `web/src/main.js`の`MapLibreMap`初期化オプションに`hash: true`を追加する(design.md Decision 5)。
- [x] 5.3 地図を操作するとURLハッシュが更新され、ハッシュ付きURLで開くと同じ位置・ズームで初期化されることをブラウザ確認で検証する。

## 6. ビューア: 背景地図の透過度とPOIラベル (Issue #50)

- [x] 6.1 `web/src/main.js`のstyle定義に`glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"`を追加する(design.md Decision 7)。
- [x] 6.2 `web/src/main.js`の`osm`レイヤに`paint: { "raster-opacity": 0.5 }`を追加する(design.md Decision 6)。
- [x] 6.3 `web/src/main.js`のカフェレイヤのlayoutに`text-field`(name/brand/operatorのcoalesce)・`text-font: ["Noto Sans Regular"]`・`text-size`・`text-variable-anchor: ["right", "bottom"]`・`text-radial-offset`を追加する(design.md Decision 7)。
- [x] 6.4 ラベル追加に合わせて、カフェレイヤの`icon-size`を0.6から0.5程度へ縮小する(design.md Decision 7)。
- [x] 6.5 背景地図が半透明で表示されること、POIラベルがアイコンの右(衝突時は下)に表示されること、店名が無いPOIでブランド名がラベルとして表示されることを、ローカルサーバー上のブラウザ確認で検証する。

## 7. ビューア: ポップアップへのconfidence・websites追加 (Issue #51)

- [x] 7.1 `web/src/main.js`の`buildCafePopupHtml`に、`properties.confidence`を百分率(`Math.round(confidence * 100)}%`)で表示する行を追加する(design.md Decision 8)。
- [x] 7.2 `web/src/main.js`の`buildCafePopupHtml`に、`properties.websites`(配列またはJSON文字列)を解釈して`http`/`https`のURLのみをリンク化して表示する行を追加する。パース失敗・非配列時は行を省略する(design.md Decision 8)。
- [x] 7.3 websitesの各リンクは`escapeHtml`でエスケープした上で`target="_blank" rel="noopener"`を付与する(design.md Decision 8)。
- [x] 7.4 `confidence`が百分率で表示されること、`websites`がリンクとして表示されること、`websites`を持たないPOIではリンクが表示されないこと、不正な`websites`値でもポップアップ全体が壊れないことを、ローカルサーバー上のブラウザ確認で検証する。

## 8. ビューア: Overture Mapsの帰属表示 (Issue #52)

- [x] 8.1 `web/src/main.js`に`OVERTURE_ATTRIBUTION`定数(Overture Maps Foundationへのクレジットを含むHTML文字列)を追加する(design.md Decision 9)。
- [x] 8.2 カフェベクタソース(`CAFE_SOURCE_ID`)の定義に`attribution: OVERTURE_ATTRIBUTION`を追加する(design.md Decision 9)。
- [x] 8.3 地図の帰属表示(AttributionControl)にOSMとOverture Maps Foundation両方のクレジットが表示されることを、ローカルサーバー上のブラウザ確認で検証する。

## 9. 動作確認 (Issue #53)

- [x] 9.1 `web`の開発/配信手順(`web/README.md`参照)でローカル配信し、ナビゲーションコントロール・URLハッシュ・confidenceフィルタ・背景地図の透過度・POIラベル・ポップアップのconfidence/websites表示・Overture Mapsの帰属表示をブラウザで一通り確認する。
- [x] 9.2 `pipeline`・`web`それぞれの既存テストスイートを実行し、リグレッションがないことを確認する。

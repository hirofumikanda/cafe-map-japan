## Why

日本全国のカフェ・喫茶店の分布を一目で把握できる地図が存在しない。OpenStreetMapには豊富なPOIデータが蓄積されているが、それを閲覧しやすい形で可視化する手段がない。ドトールやベローチェのような全国チェーンと個人経営の喫茶店が地図上で視覚的に区別できれば、店舗展開の分析や利用者の店探しに役立つ。

## What Changes

- Overpass APIを用いて日本全国のカフェ・喫茶店POI(`amenity=cafe`等)をGeoJSONとして取得するデータ取得スクリプトを新設する。
- 取得したGeoJSONをMVT(Mapbox Vector Tile)形式のPMTilesアーカイブに変換するビルドパイプラインを新設する。ズームレベルはz10-14で生成する。
- 生成したPMTilesファイルを静的ファイルとして配信する(HTTP Range対応の静的ホスティング)。
- MapLibre GL JS v6を用いたWebマップフロントエンドを新設する。
  - 背景地図としてOpenStreetMap Standardタイルを表示する。
  - PMTilesからカフェ・喫茶店POIをシンボルレイヤとして表示する。
  - POIクリック時にポップアップで店名・住所等のプロパティを表示する。
  - チェーン名(ドトール、ベローチェ等)を判定し、専用アイコンで視覚的に区別する。個人店・未分類チェーンは汎用アイコンで表示する。

## Capabilities

### New Capabilities
- `cafe-poi-pipeline`: Overpass APIからのカフェ・喫茶店POI取得、GeoJSON化、PMTiles(MVT, z10-14)への変換、成果物の静的配信を担うデータパイプライン。
- `cafe-map-viewer`: MapLibre GL JS v6を用いて背景地図(OSM Standard)とカフェ・喫茶店POIレイヤを表示し、クリックでポップアップ表示、チェーン店をアイコンで判別できるWebマップフロントエンド。

### Modified Capabilities
(なし。新規プロジェクトのため既存capabilityは存在しない。)

## Impact

- 新規追加: データ取得・変換スクリプト(Overpass APIクライアント、GeoJSON→PMTiles変換処理)。
- 新規追加: 生成物(GeoJSON中間ファイル、PMTilesファイル)の配置・配信設定。
- 新規追加: MapLibre GL JS v6を用いたフロントエンド一式(HTML/JS、スタイル定義、アイコンアセット)。
- 外部依存: Overpass API(実行時ではなくビルド/更新時にのみ呼び出す)、OpenStreetMap Standardタイルサーバー(実行時に地図タイルを取得)。
- 新規依存ライブラリ: MapLibre GL JS v6、PMTiles生成・配信用ツール(例: tippecanoe/pmtiles CLI等、design.mdで詳細化)。

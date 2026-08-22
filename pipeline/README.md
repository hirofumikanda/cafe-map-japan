# pipeline

Overpass APIから日本全国のカフェ・喫茶店POIを取得し、GeoJSONを経てPMTiles(MVT, z10-14)へ変換するデータパイプライン。

OpenSpec Change: `cafe-map-japan`

## 必要なツール

- **Node.js 18以上**: Overpass APIクライアントの実行環境。標準の`fetch`を利用する。
- **[tippecanoe](https://github.com/felt/tippecanoe)**: GeoJSONをPMTilesへ変換するCLIツール。npmパッケージではないため、OSのパッケージマネージャ等で別途インストールする(例: `brew install tippecanoe`)。
- **[pmtiles](https://www.npmjs.com/package/pmtiles)**: 生成したPMTilesのメタデータ検証に使うCLI/ライブラリ(devDependenciesに定義)。

## セットアップ

```bash
npm install
```

## 使い方

```bash
# 1. Overpass APIからPOIを取得し、out/cafe.geojsonを生成する
npm run fetch

# 2. out/cafe.geojsonをout/cafe.pmtiles(z10-14, source-layer: cafe)へ変換する
npm run build:tiles

# 3. 生成されたcafe.pmtilesのメタデータ(minzoom/maxzoom)とサンプルPOIの存在を検証する
npm run verify:tiles
```

入出力パスは環境変数`CAFE_GEOJSON_PATH`・`CAFE_PMTILES_PATH`で上書きできる。`verify:tiles`のサンプル件数は`CAFE_VERIFY_SAMPLE_SIZE`(既定値5)で調整できる。

## ディレクトリ構成

- `src/`: Overpass APIからの取得・GeoJSON変換・PMTiles変換スクリプトを配置する。
  - `fetch-pois.js`: Overpass APIからPOIを取得し`out/cafe.geojson`を生成する。
  - `build-tiles.js`: tippecanoeで`out/cafe.geojson`を`out/cafe.pmtiles`(z10-14, source-layer: `cafe`)へ変換する。
  - `verify-tiles.js`: 生成された`cafe.pmtiles`のズーム範囲メタデータと、サンプルPOIがz14タイル内にFeatureとして存在することを検証する。
- `out/`: 生成物の出力先(gitignore対象、`npm run fetch`/`npm run build:tiles`で再生成される)。

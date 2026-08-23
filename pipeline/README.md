# pipeline

Overture Maps Places(Overture Maps Foundation)から日本全国のカフェ・喫茶店POIを取得し、GeoJSONを経てPMTiles(MVT, z10-14)へ変換するデータパイプライン。

OpenSpec Change: `overture-places-source-and-pages-deploy`(取得元をOverpass APIからOverture Placesへ移行。旧: `cafe-map-japan`)

## 必要なツール

- **Node.js 18以上**: 各スクリプトの実行環境。
- **[DuckDB CLI](https://duckdb.org/docs/installation/)**: Overture Places(AWS S3上のGeoParquet)をクエリするために使用する。`spatial`・`httpfs`拡張が必要だが、`overture-client.js`が発行するクエリ内で`INSTALL`/`LOAD`するため、事前の拡張インストールは不要。npmパッケージではないため、OSのパッケージマネージャ等で別途インストールする(例: `brew install duckdb`、または[公式インストールスクリプト](https://duckdb.org/docs/installation/)を使用)。
- **[tippecanoe](https://github.com/felt/tippecanoe)**: GeoJSONをPMTilesへ変換するCLIツール。npmパッケージではないため、OSのパッケージマネージャ等で別途インストールする(例: `brew install tippecanoe`)。
- **[pmtiles](https://www.npmjs.com/package/pmtiles)**: 生成したPMTilesのメタデータ検証に使うCLI/ライブラリ(devDependenciesに定義)。

## セットアップ

```bash
npm install
```

## 使い方

```bash
# 1. Overture Places(theme=places, type=place)からPOIを取得し、out/cafe.geojsonを生成する
OVERTURE_RELEASE=2026-08-19.0 npm run fetch

# 2. out/cafe.geojsonをout/cafe.pmtiles(z10-14, source-layer: cafe)へ変換する
npm run build:tiles

# 3. 生成されたcafe.pmtilesのメタデータ(minzoom/maxzoom)とサンプルPOIの存在を検証する
npm run verify:tiles
```

入出力パスは環境変数`CAFE_GEOJSON_PATH`・`CAFE_PMTILES_PATH`で上書きできる。`verify:tiles`のサンプル件数は`CAFE_VERIFY_SAMPLE_SIZE`(既定値5)で調整できる。

### `npm run fetch`の環境変数

- `OVERTURE_RELEASE`(必須): クエリ対象のOverture Mapsリリースバージョン(例: `2026-08-19.0`)。Overture Placesは日付付きのリリース単位でS3上に公開されており、最新のリリース一覧は[Overture Maps release notes](https://docs.overturemaps.org/release/latest/)で確認できる。未指定の場合、`queryOverturePlaces`(`overture-client.js`)がエラーを投げ、不完全なGeoJSONを出力せずに失敗する。

取得条件(対象bbox・カテゴリ・confidenceのしきい値・国コードによる絞り込み)は`pipeline/src/overture-client.js`にハードコードされており、環境変数による調整項目ではない(詳細は`openspec/changes/overture-places-source-and-pages-deploy/design.md`参照)。

## ディレクトリ構成

- `src/`: Overture Placesからの取得・GeoJSON変換・PMTiles変換スクリプトを配置する。
  - `overture-client.js`: DuckDB CLIをサブプロセス実行し、Overture Places(theme=places, type=place)を日本を覆うbbox・カテゴリ・confidence・国コードの条件でクエリする。
  - `geojson.js`: Overture Placesレコードを、既存のPMTiles変換・チェーン判定(`web/src/chains.js`)がそのまま利用できるGeoJSON Point Featureへ変換する。
  - `fetch-pois.js`: `overture-client.js`・`geojson.js`を組み合わせてOverture PlacesからPOIを取得し`out/cafe.geojson`を生成する。
  - `build-tiles.js`: tippecanoeで`out/cafe.geojson`を`out/cafe.pmtiles`(z10-14, source-layer: `cafe`)へ変換する。
  - `verify-tiles.js`: 生成された`cafe.pmtiles`のズーム範囲メタデータと、サンプルPOIがz14タイル内にFeatureとして存在することを検証する。
- `out/`: 生成物の出力先(gitignore対象、`npm run fetch`/`npm run build:tiles`で再生成される)。

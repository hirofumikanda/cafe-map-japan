# pipeline

Overpass APIから日本全国のカフェ・喫茶店POIを取得し、GeoJSONを経てPMTiles(MVT, z10-14)へ変換するデータパイプライン。

OpenSpec Change: `cafe-map-japan`

## 必要なツール

- **Node.js 18以上**: Overpass APIクライアントの実行環境。
- **curl**: Overpass APIへのHTTPリクエストに使用する(開発環境によってはNode.js組み込みの`fetch`がOverpass APIホストへの接続でタイムアウトすることがあるため、`overpass-client.js`はcurlをサブプロセスとして呼び出す)。
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

### `npm run fetch`の環境変数

- `OVERPASS_PREFECTURES`: `"JP-13,JP-27"`のようにカンマ区切りで指定すると、対象都道府県を絞り込める(動作確認用)。未指定時は全国47都道府県が対象。
- `OVERPASS_REQUEST_INTERVAL_MS`: 都道府県クエリ間のウェイト(既定値1000ms)。公開Overpassインスタンスの利用ポリシーへの配慮のため、レート制限が気になる場合は増やす。
- `OVERPASS_FORCE_REFETCH=1`: 後述の都道府県キャッシュを無視し、全都道府県を強制的に再取得する。通常は不要。

### 都道府県キャッシュによる再実行時のレート制限緩和

`npm run fetch`は取得に成功した都道府県ごとの結果を`out/.prefecture-cache/<都道府県コード>.json`へキャッシュする。途中でOverpass APIへの接続失敗等により処理が失敗した場合、`out/cafe.geojson`は書き出されない(不完全なGeoJSONを正常出力として扱わないため)が、**成功済みの都道府県のキャッシュは残る**。そのまま`npm run fetch`を再実行すると、キャッシュ済みの都道府県はOverpass APIへ再リクエストせずスキップされ、未取得の都道府県のみを取得する。これにより、公開Overpassインスタンスのレート制限に抵触した後の再試行で不要なリクエストを重ねてしまうことを避けられる。

キャッシュは`out/`配下にあるため、`rm -rf out`で他の生成物と一緒に破棄できる。全都道府県を最初から取り直したい場合は`OVERPASS_FORCE_REFETCH=1`を指定する。

## ディレクトリ構成

- `src/`: Overpass APIからの取得・GeoJSON変換・PMTiles変換スクリプトを配置する。
  - `fetch-pois.js`: Overpass APIからPOIを取得し`out/cafe.geojson`を生成する。都道府県単位のキャッシュ(`prefecture-cache.js`)により、失敗後の再実行では未取得分のみを取得する。
  - `prefecture-cache.js`: 都道府県ごとの取得結果を`out/.prefecture-cache/`へキャッシュする。
  - `build-tiles.js`: tippecanoeで`out/cafe.geojson`を`out/cafe.pmtiles`(z10-14, source-layer: `cafe`)へ変換する。
  - `verify-tiles.js`: 生成された`cafe.pmtiles`のズーム範囲メタデータと、サンプルPOIがz14タイル内にFeatureとして存在することを検証する。
- `out/`: 生成物の出力先(gitignore対象、`npm run fetch`/`npm run build:tiles`で再生成される)。都道府県キャッシュ(`.prefecture-cache/`)もここに置かれる。

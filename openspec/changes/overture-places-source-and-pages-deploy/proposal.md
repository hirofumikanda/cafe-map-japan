## Why

Overpass APIは公開インスタンスのレート制限・タイムアウトに左右されやすく、都道府県単位の分割取得やキャッシュ機構が必要になるなど運用コストが高い。Overture Maps FoundationのPlacesデータはS3/Azure上のGeoParquetとして配布され、`confidence`スコアによる品質フィルタも可能なため、より安定した取得元に切り替える。また、現状Webフロントエンドは手動でしかデプロイできないため、GitHub Pagesへの公開を自動化する。

## What Changes

- **BREAKING**: `pipeline`のPOI取得元をOverpass API(`overpass-client.js`)からOverture Maps Placesデータ(GeoParquet)に変更する。Overpass固有の都道府県単位クエリ・レート制限・都道府県キャッシュ(`prefecture-cache.js`)は、この取得方式では不要になるため廃止する。
- Overture Places取得時、`confidence`が0.9以上のレコードのみを対象とする(0.9未満は除外)。
- Overture Placesのカフェ・喫茶店相当カテゴリ(`categories.primary`が`cafe`または`coffee_shop`)のみを対象とし、日本国内のレコードに絞り込む。
- 取得したOverture Placesの属性(店名・ブランド・カテゴリ等)をGeoJSON FeatureのpropertiesとしてOSMタグ相当の形に変換し、既存のPMTiles変換(`build-tiles.js`)・チェーン判定(`web/src/chains.js`)がそのまま利用できるようにする。
- `web/`をビルドし、GitHub Pagesへ自動デプロイするGitHub Actionsワークフローを新設する。トリガーは`main`ブランチへのpushおよび手動実行(`workflow_dispatch`)。
- デプロイワークフローはWebフロントエンドのビルド・公開のみを担い、Overture Placesの取得・PMTiles生成(データパイプラインの実行)は対象外とする。`web/public/cafe.pmtiles`はワークフロー実行前にリポジトリへ用意されている前提とする(詳細はdesign.md参照)。
- Overture Placesの住所情報(`addresses[0].freeform`)をGeoJSON Featureのpropertiesに`address`として保持し、`web/src/main.js`のポップアップ住所表示(現状OSMの`addr:*`タグの組み合わせが前提)をOverture由来のデータに対応させる。対応しない場合、Overture移行後はポップアップに住所が表示されなくなる回帰が生じる。
- Overture Places取得のSQL(`overture-client.js`)で、STRUCT/LIST型の属性列(`names`・`categories`・`brand`・`addresses`)をDuckDBの`-json`出力でも正しくネストしたJSONとして得られるよう`to_json()`でラップする(現状は非JSON文字列として出力され、`addresses`ベースの国コードフィルタが実データに対して常に空集合を返す不具合があるため)。

## Capabilities

### New Capabilities
- `site-deployment`: GitHub ActionsによるWebフロントエンドのビルドとGitHub Pagesへの自動デプロイ

### Modified Capabilities
- `cafe-poi-pipeline`: POIの取得元をOverpass APIからOverture Maps Places(confidence >= 0.9のみ)に変更する

## Impact

- `pipeline/src/overpass-client.js`・`pipeline/src/overpass-client.test.js`: 削除し、Overture Places取得用モジュールに置き換える。
- `pipeline/src/prefecture-cache.js`・`pipeline/src/prefecture-cache.test.js`・`pipeline/src/prefectures.js`: Overpass都道府県分割取得に付随する仕組みのため削除または大幅縮小(国別/範囲指定のみ残す可能性)。
- `pipeline/src/fetch-pois.js`: Overture Places取得フローに書き換え。
- `pipeline/src/geojson.js`: 入力がOverpass elementsからOverture Placesレコードに変わるため変換ロジックを見直す。
- `pipeline/README.md`: 取得元・環境変数・セットアップ手順(DuckDB等の追加ツール)を更新。
- `openspec/specs/cafe-poi-pipeline/spec.md`: 取得元要件を更新。
- 新規: `.github/workflows/`配下にGitHub Pagesデプロイ用ワークフローを追加。
- `web/README.md`: デプロイ手順(GitHub Actions経由)を追記。
- `web/src/main.js`: ポップアップ住所表示(`ADDRESS_KEYS`・`buildCafeAddress`)を、OSMの`addr:*`タグ前提から`properties.address`を直接参照する実装に置き換える。
- `pipeline/src/overture-client.js`: SELECT句の`names`・`categories`・`brand`・`addresses`列を`to_json()`でラップし、DuckDB `-json`出力での非JSON文字列化を修正する。
- 追加の外部ツール依存(Overture Places取得に使うDuckDB等)がpipelineの前提環境に加わる。

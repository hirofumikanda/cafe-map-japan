## Context

`pipeline`は現在、Overpass API(`overpass-client.js`)へ都道府県単位(ISO3166-2 admin_level=4境界)でクエリを発行し、レート制限対策として`prefecture-cache.js`で取得結果をキャッシュしている(archive済み変更`cafe-map-japan`のDecision 1)。この構成はOverpassの公開インスタンスのレート制限・タイムアウトに強く依存しており、47都道府県の逐次取得に時間がかかる。

Overture Maps FoundationのPlacesデータは、AWS S3(`s3://overturemaps-us-west-2/release/`)およびMicrosoft Azure上でGeoParquet形式(theme=`places`, type=`place`)として公開されている。各レコードは`confidence`(0-1のスコア)・`categories.primary`/`alternate`・`names`・`brand`・`addresses`等のフィールドを持つ。Hive形式のパーティショニングとbbox列の統計情報により、地理的範囲を指定したクエリはリモートのParquetに対して範囲取得(HTTPレンジ)で絞り込める。

Webフロントエンド側は現状、GitHub Pagesを本番ホスティング先として選定済み(archive済み変更のDecision 3、`web/README.md`)だが、デプロイは手動([`cp`+`npm run build`]相当の手順)である。

## Goals / Non-Goals

**Goals:**
- Overpass APIへの依存(レート制限・都道府県分割・キャッシュ機構)を取り除き、Overture Maps Placesを取得元にする。
- `confidence >= 0.9`のカフェ・喫茶店POIのみを対象にする。
- `web`のビルドとGitHub Pagesへのデプロイを、pushまたは手動実行で自動化する。

**Non-Goals:**
- デプロイワークフローの中でOverture Placesの取得・PMTiles生成(データパイプラインの実行)を行うこと。これはユーザーの選択により本変更のスコープ外とする。
- Overture Places以外のデータソース(例: Google Places等)との統合。
- カフェカテゴリの分類体系そのものの見直し(既存の`web/src/chains.js`のチェーン判定ロジックは変更しない)。

## Decisions

### Decision 1: Overture Places取得にDuckDB(spatial/httpfs拡張)を使う
`tippecanoe`と同様、追加インストールが必要な外部CLIとして`duckdb`を採用する。理由:
- Overture Maps公式ドキュメントが推奨する取得方法であり、`ST_Read`/`httpfs`拡張でリモートParquetを直接クエリでき、bbox列の統計によるプルーニングで日本国内相当のデータのみを効率的に読み出せる。
- SQLで`categories.primary IN ('cafe', 'coffee_shop')`・`confidence >= 0.9`・`bbox`条件を一度に適用でき、`ST_AsGeoJSON`で直接GeoJSON化できるため、Python等の追加言語ランタイムを持ち込まずに済む。
- 代替案として検討した`overturemaps` Python CLIは、bboxによるダウンロードは可能だが`confidence`やカテゴリでのサーバーサイド絞り込みができず、全件ダウンロード後にNode.js側でフィルタする必要があり、転送量が増える。また新たにPython環境を前提にすることになり、既存のNode.js中心の構成と整合しない。

`pipeline/src/overpass-client.js`を`pipeline/src/overture-client.js`に置き換え、`spawn`でduckdb CLIを呼び出しGeoJSON Lines(または一時ファイル)を得る方式を、既存の`tippecanoe`呼び出し(`build-tiles.js`)と同じ「外部CLIをサブプロセスとして呼ぶ」パターンに揃える。

### Decision 2: 地理的絞り込みはbboxで行い、都道府県分割・レート制限対策は廃止する
Overpassのような公開インスタンスのレート制限が存在しないため、都道府県単位のクエリ分割・待機(`REQUEST_INTERVAL_MS`)・`prefecture-cache.js`による再開キャッシュは不要になる。日本全体を1回のクエリ(日本を覆う矩形bbox: 概ね経度122〜154、緯度20〜46)で取得する。

このbboxには日本国外の地点(近隣国の一部等)が理論上含まれ得るため、Overtureレコードの`addresses`配列に含まれる国コードが`JP`であるものに限定する。`addresses`を持たないレコードは、bboxに基づき本州・北海道・四国・九州・沖縄を含む範囲であっても国外分を誤って含む可能性があるため、国コード判定ができないレコードは対象外とする(Overpassの行政境界ベースの絞り込みと比べて対象範囲が保守的になる点はRisksに記載)。

- 代替案: Overtureの`divisions`テーマから日本の国境ポリゴンを取得し`ST_Within`で厳密に絞り込む方法も検討したが、追加テーマの取得・結合が必要になり実装コストが増すため、今回は`addresses.country = 'JP'`による絞り込みを採用する。

### Decision 3: カテゴリ対応表は`categories.primary`が`cafe`または`coffee_shop`
既存のOSM `amenity=cafe`相当として、Overtureのカテゴリ体系(Meta提供のPlaces taxonomy)における`cafe`・`coffee_shop`をカフェ・喫茶店として扱う。`categories.alternate`側の一致は対象外とし、`categories.primary`のみで判定する(誤検出を避けるため)。

### Decision 4: GeoJSON変換の属性マッピング
`pipeline/src/geojson.js`の`elementsToFeatures`をOverture Placesレコード向けに書き換え、`properties`に少なくとも次を設定する:
- `name`: `names.primary`
- `brand`: `brand.names.primary`(存在する場合)
- `operator`: 相当するOverture属性が無いため設定しない(既存の`web/src/chains.js`は`brand`/`name`ベースの照合を優先させ、後方互換のため空文字ではなくキー自体を省略する)
- その他、既存のチェーン判定・ポップアップ表示が参照する属性名(`name`、`brand`)を優先してOSMタグ互換の形にする

`web/src/chains.js`のチェーン判定ロジックは`brand`/`operator`/`name`の値を見て照合するため、Overture由来のpropertiesでも`name`・`brand`が設定されていれば変更不要と想定する。実装時にチェーン判定のテスト(`chains.test.js`)がOverture由来のプロパティ形状でも成立することを確認する。

### Decision 5: GitHub Actionsは`web`のビルド・デプロイのみを行う
ユーザーの選択により、デプロイワークフローはOverture Places取得・PMTiles生成を含まない。そのため`web/public/cafe.pmtiles`はワークフロー実行前にリポジトリのチェックアウト対象に含まれている必要がある。

現状`.gitignore`は`*.pmtiles`を一律で除外しているため、このままではGitHub Actions上のcheckoutで`cafe.pmtiles`を得られない。本変更では、`.gitignore`を次の方針に更新する:
- `web/public/cafe.pmtiles`はGitHub Pagesデプロイに必要なため、gitignoreの対象から外し、リポジトリにコミットする運用とする。
- `pipeline`が生成する中間生成物(`out/cafe.geojson`を含む`pipeline/out/`配下一式)は、これまで通りgitignore対象のままとし、git管理しない。GeoJSONはOverture Places取得のたびに再生成されるビルド中間生成物であり、コミット対象はPMTiles化された最終成果物(`web/public/cafe.pmtiles`)のみとする。

データ更新時は、開発者がローカルで`pipeline`を実行して`out/cafe.geojson`・`out/cafe.pmtiles`を生成し(いずれもgit管理外)、`cafe.pmtiles`のみを`web/public/`にコピーしてコミット・pushする運用とする。

- 代替案: GitHub Releaseやartifactストレージ、別リポジトリ/ブランチへのpmtiles配置も検討したが、追加のインフラ・権限設定が必要になり「pipelineの実行は含めない」というスコープに対して過剰なため見送る。将来的にpipeline実行を自動化する変更を別途行う場合は、この運用を置き換える。

ワークフローの構成(GitHub Pages公式Actions):
1. `actions/checkout`
2. `actions/setup-node`
3. `web`ディレクトリで`npm ci` → `npm run build`
4. `actions/configure-pages`
5. `actions/upload-pages-artifact`(`web/public`を対象)
6. `actions/deploy-pages`

`pages: write`・`id-token: write`権限を持つデプロイジョブを、ビルドジョブと分離し、ビルド失敗時はデプロイジョブが実行されないようにする(`needs`で依存させる)。

## Risks / Trade-offs

- [Overture Placesのbbox+国コード絞り込みは、OSMの行政境界ベースの絞り込みより対象範囲が保守的] → `addresses`を持たないレコードは対象外になるため、Overpass時と比べて収録POI数が減る可能性がある。実データでの件数比較をtasksの検証項目に含める。
- [DuckDBという新しい外部ツール依存が増える] → `tippecanoe`と同様にREADMEにインストール手順を明記し、CIやローカル環境でのインストール手順を揃える。
- [`cafe.pmtiles`をリポジトリにコミットする運用は、ファイルサイズの増大・Git履歴の肥大化を招く] → 当面は許容し、サイズが問題になった場合はGit LFSまたは別のデプロイ方式(Decision 5の代替案)へ移行を検討する。
- [confidence>=0.9のみを対象にすることでカバレッジが下がる] → ユーザー要件として明示されているため許容する。除外件数が把握できるよう取得ログに件数を出力する。
- [Overtureのカテゴリ体系がOSMの`amenity=cafe`と完全一致しない] → `cafe`/`coffee_shop`の2カテゴリに限定することで既知の誤検出リスクを抑えるが、実データ確認により調整が必要になる可能性がある。

## Migration Plan

1. `pipeline`側のOverture Places取得実装・テストを追加し、Overpass関連実装(`overpass-client.js`・`prefecture-cache.js`・関連テスト)を削除する。
2. `pipeline/README.md`を更新し、DuckDBのインストール手順・新しい環境変数を記載する。
3. ローカルで新しい取得フローを実行し、`cafe.pmtiles`を再生成、`web/public/`へ配置してコミットする(`.gitignore`更新後)。
4. GitHub Actionsワークフローを追加し、GitHub Pagesのソース設定(Settings > Pages > Source: GitHub Actions)をリポジトリ側で行う(手動作業、tasksに記載)。
5. `main`へのマージ後、ワークフローが自動実行されデプロイされることを確認する。

ロールバック: Overture Places関連の変更に問題があれば、Overpassベースの実装は変更前のコミットから復元可能(既存の`cafe-poi-pipeline`のOverpass要件はREMOVEDとして記録されており、archive履歴からも参照できる)。デプロイワークフローに問題がある場合は、GitHub Pagesの手動デプロイ手順(既存README記載)に一時的に戻す。

## 1. Overture Places取得の実装 (Issue #22)

- [x] 1.1 `pipeline/src/overture-client.js`を新設し、DuckDB CLI(spatial/httpfs拡張)をサブプロセス実行してOverture Maps Places(theme=places, type=place)を、日本を覆うbbox・`categories.primary IN ('cafe','coffee_shop')`・`confidence >= 0.9`の条件でクエリしGeoJSON形式のレコード群を取得する関数を実装する
- [x] 1.2 取得したレコードのうち`addresses`配列に国コード`JP`を含まないものを除外するフィルタを実装する(design.md Decision 2)
- [x] 1.3 `overture-client.js`のユニットテスト(`overture-client.test.js`)を追加し、DuckDB呼び出し部分をモック/スタブしてクエリ条件・フィルタ挙動を検証する

## 2. GeoJSON変換の書き換え (Issue #23)

- [x] 2.1 `pipeline/src/geojson.js`を、Overture PlacesレコードをGeoJSON Point Featureへ変換する実装に書き換える(`name`←`names.primary`、`brand`←`brand.names.primary`等、design.md Decision 4)
- [x] 2.2 `pipeline/src/geojson.test.js`をOverture Placesレコード形状の入力に合わせて更新する

## 3. fetch-poisフローの更新 (Issue #24)

- [x] 3.1 `pipeline/src/fetch-pois.js`を、都道府県分割ループを廃止し単一のOverture Places取得呼び出しに書き換える
- [x] 3.2 `pipeline/src/prefectures.js`・`pipeline/src/prefecture-cache.js`・`pipeline/src/prefecture-cache.test.js`を削除する(Overpass都道府県分割取得に付随する仕組みのため)
- [x] 3.3 `pipeline/src/overpass-client.js`・`pipeline/src/overpass-client.test.js`を削除する
- [x] 3.4 `fetch-pois.js`の環境変数(`OVERPASS_*`)をOverture用の命名に置き換える(例: `OVERTURE_*`)。取得失敗時に不完全なGeoJSONを出力しない挙動は維持する

## 4. 実データでの検証 (Issue #25)

- [x] 4.1 ローカルでDuckDBをインストールし、`npm run fetch`相当のOverture Places取得を実行して`out/cafe.geojson`が生成されることを確認する
- [x] 4.2 取得件数・confidence除外件数をOverpass時と比較し、design.mdのRisksに記載した収録POI数の変化を確認する
- [x] 4.3 `npm run build:tiles`・`npm run verify:tiles`が変更なしで成功することを確認する
- [x] 4.4 `web/src/chains.test.js`がOverture由来のproperties形状でも成立することを確認する(既存テストが通ることの確認、必要ならテストケースを追加)

## 5. ドキュメント更新 (Issue #26)

- [x] 5.1 `pipeline/README.md`を更新し、Overture Places取得手順・DuckDBのインストール方法・新しい環境変数を記載する
- [x] 5.2 ルートまたは`pipeline/README.md`に記載のOverpass関連の記述(旧取得元の説明)を削除・更新する

## 6. GitHub Actionsによるデプロイ自動化 (Issue #27)

- [x] 6.1 `.gitignore`を更新し、`web/public/cafe.pmtiles`はgitignore対象から外してコミット可能にする一方、`pipeline/out/`配下(`out/cafe.geojson`を含む中間生成物一式)は引き続きgit管理しないようにする
- [x] 6.2 ローカルで生成した`cafe.pmtiles`を`web/public/cafe.pmtiles`に配置し、コミットする
- [x] 6.3 `.github/workflows/deploy-pages.yml`を新設し、`main`へのpushと`workflow_dispatch`をトリガーに、`web`ディレクトリで`npm ci`・`npm run build`を実行するビルドジョブを定義する
- [x] 6.4 同ワークフローに、ビルドジョブに依存するデプロイジョブ(`actions/configure-pages`・`actions/upload-pages-artifact`・`actions/deploy-pages`、`pages: write`・`id-token: write`権限)を追加する
- [x] 6.5 GitHub Pages公開のためのビルド成果物パスをbase pathを考慮して`web/public`に設定する(GitHub Pagesのサブパス配信、web/README.md記載の既存注意点)
- [x] 6.6 `web/README.md`のデプロイ手順を、GitHub Actions経由の自動デプロイに書き換える(GitHub Pages側のSource設定をGitHub Actionsにする手順を含む)

## 7. 動作確認 (Issue #28)

- [x] 7.1 `main`ブランチへpushし、GitHub Actions上でビルド・デプロイが成功することを確認する
- [x] 7.2 GitHub PagesのURLでWebフロントエンドが表示され、`cafe.pmtiles`が正しく配信される(HTTP Rangeリクエストに対応する)ことを確認する
- [x] 7.3 `workflow_dispatch`による手動実行が成功することを確認する

## 8. cafe-map-viewerポップアップのOverture対応 (Issue #31)

- [x] 8.1 `pipeline/src/geojson.js`の`elementsToFeatures`に、Overture Placesレコードの`addresses[0].freeform`相当を`address`プロパティとして追加する(design.md Decision 4)
- [x] 8.2 `pipeline/src/geojson.test.js`に`address`属性の変換を検証するテストケースを追加する
- [x] 8.3 `web/src/main.js`の`buildCafeAddress`・`ADDRESS_KEYS`を、OSMの`addr:*`タグ前提から`properties.address`を直接参照する実装に置き換える
- [x] 8.4 ローカルで生成したOverture由来のGeoJSON/PMTilesを使い、ポップアップに住所が表示されることを手動確認する

## 9. overture-client.jsのJSON出力バグ修正 (Issue #33)

- [x] 9.1 `pipeline/src/overture-client.js`の`buildQuery`のSELECT句で、`names`・`categories`・`brand`・`addresses`列を`to_json()`でラップし、DuckDB `-json`出力で正しくネストしたJSONとして得られるようにする(design.md Decision 1)
- [x] 9.2 `pipeline/src/overture-client.test.js`に、実際のDuckDB `-json`出力に近い形(`to_json()`でラップされたJSON)のexecImplレスポンスを用いたテストケースを追加し、`addresses`の国コードフィルタが正しく機能することを検証する
- [x] 9.3 実データ(DuckDB + Overture Maps)に対して`queryOverturePlaces`を実行し、日本国内のカフェ・喫茶店POIが正しく取得できることを確認する

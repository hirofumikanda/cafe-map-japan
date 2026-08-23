# web

MapLibre GL JS v6を用いて、OpenStreetMap Standard背景地図上に日本全国のカフェ・喫茶店POIを表示するWebマップフロントエンド。

OpenSpec Change: `cafe-map-japan`

## 依存ライブラリ

- **[maplibre-gl](https://www.npmjs.com/package/maplibre-gl) v6**: 地図描画ライブラリ。
- **[pmtiles](https://www.npmjs.com/package/pmtiles)**: `pipeline`で生成した`cafe.pmtiles`をMapLibreのvector sourceとして読み込むためのProtocolハンドラ。

## セットアップ

```bash
npm install
```

## ビルド

バンドラは使用せず、ブラウザがそのまま`import`できるESMバンドルをそのまま配信する構成にしている。`npm run build`は次を行う。

- `node_modules/maplibre-gl/dist/`のESMバンドル(`maplibre-gl.mjs`・`maplibre-gl-shared.mjs`・`maplibre-gl-worker.mjs`・`maplibre-gl.css`)を`public/vendor/maplibre-gl/`へコピーする。
- `node_modules/pmtiles/dist/index.js`を`public/vendor/pmtiles/index.js`へコピーする(`cafe.pmtiles`を`pmtiles://`経由でMapLibreのvector sourceとして読み込むためのProtocolハンドラ)。
- `src/`配下のブラウザ実行用スクリプト(`*.test.js`を除く)を`public/`へコピーする。

```bash
npm run build
```

`public/index.html`は[import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)で`"maplibre-gl"`・`"pmtiles"`をそれぞれ`./vendor/`配下へ解決するため、`src/main.js`は通常のnpmパッケージと同じ書き方(`import { Map } from "maplibre-gl"`、`import { Protocol } from "pmtiles"`)でインポートできる。`public/vendor/`・`public/*.js`はビルド生成物のため.gitignore対象。

## 静的配信(開発用サーバー)

`server/serve.js`は、`public/`配下をHTTP Rangeリクエスト(206 Partial Content)対応で配信する開発用の静的サーバーです。PMTilesはクライアントがバイト範囲リクエストでタイルを取り出す方式のため、配信元がRangeリクエストに正しく応答できることが必須条件になります(design.md 決定3)。

```bash
# pipelineが生成したcafe.pmtilesをpublic/に配置してから起動する
cp ../pipeline/out/cafe.pmtiles public/cafe.pmtiles
npm run serve   # http://localhost:8080/ (PORT環境変数で変更可)
```

Rangeリクエストへの応答は次のように確認できる。

```bash
curl -i -r 0-99 http://localhost:8080/cafe.pmtiles
# => HTTP/1.1 206 Partial Content
#    Content-Range: bytes 0-99/<ファイルサイズ>
```

### 本番環境へのデプロイ

本番環境のホスティング先は**GitHub Pages**に決定した(design.md Decision 3参照)。GitHub Pages(Fastly/Varnish CDN経由)は静的ファイルへのHTTP Rangeリクエストを標準でサポートしており、実ファイルへの`curl -r`検証で`206 Partial Content`・正しい`Content-Range`が返ることを確認済み。

デプロイは`.github/workflows/deploy-pages.yml`(GitHub Actions)により自動化されている(`overture-places-source-and-pages-deploy` design.md Decision 5)。`main`ブランチへのpush、またはActions画面からの手動実行(`workflow_dispatch`)をトリガーに、`web`ディレクトリで`npm ci`・`npm run build`を実行するビルドジョブと、それに続けて`public/`配下を`actions/upload-pages-artifact`・`actions/deploy-pages`でGitHub Pagesへ公開するデプロイジョブが実行される。ビルドジョブが失敗した場合、デプロイジョブは実行されない(`needs`による依存)。

このワークフローは`web`のビルド・デプロイのみを行い、Overture Places取得・PMTiles生成(`pipeline`の実行)は含まない。そのため`public/cafe.pmtiles`はワークフロー実行前にリポジトリへコミットされている必要がある。データ更新時は、開発者がローカルで`pipeline`を実行して`cafe.pmtiles`を再生成し、`public/cafe.pmtiles`へコピーしてコミット・pushする(`pipeline/README.md`参照)。

初回のみ、リポジトリのSettings > Pages > Source を **GitHub Actions** に設定する手動作業が必要(GitHub UI上の設定で、コードやワークフロー定義には含まれない)。

GitHub Pagesのプロジェクトサイトは`https://<user>.github.io/<repo>/`というサブパス配下で配信されるため、`public/index.html`・`src/main.js`はいずれも相対パス(`./vendor/...`・`./main.js`、および`window.location.href`基準で解決する`cafe.pmtiles`のURL)でフロントエンド資産を参照する設計になっており、追加のbase path設定なしにサブパス配信へ対応できる。`server/serve.js`はローカル開発・動作確認用であり、本番配信そのものを担うことは想定していない。

## ディレクトリ構成

- `src/`: 地図初期化・レイヤ定義・ポップアップ・アイコン判定ロジックを配置する(`npm run build`で`public/`へコピーされる)。
  - `main.js`: MapLibre GL JS v6で地図を初期化し、OpenStreetMap Standardを背景地図として表示する。`pmtiles`の`Protocol`を`addProtocol`に登録し、配信されている`cafe.pmtiles`をvector source(`pmtiles://`)として読み込み、`cafe`レイヤ(symbol)としてPOIを表示する。POIシンボルのクリックで店名・ブランド・住所等のプロパティをポップアップ表示する。チェーン専用・汎用アイコンをcanvasで生成し、`chains.js`の照合テーブルから組み立てた`case`式で`icon-image`を切り替える。
  - `chains.js`: 既知チェーン名(ドトール、ベローチェ等)とアイコンID・図形・色を対応付ける照合テーブル、ブランド名表記ゆれ(全角/半角、法人格の有無等)を吸収する正規化・一致判定ロジック、MapLibreの`icon-image`用`case`式を組み立てる関数を提供する。新しいチェーンを追加する場合は`CHAIN_TABLE`にエントリを1件追加するだけでよい。
- `public/`: 静的配信するHTML、アイコンスプライト、`pipeline`が生成する`cafe.pmtiles`を配置する。`vendor/`と`*.js`は`npm run build`の生成物。
- `scripts/build.js`: `npm run build`の実体(vendorアセットのコピー、`src/`スクリプトのコピー)。
- `server/serve.js`: `public/`をHTTP Range対応で配信する開発用静的サーバー(`npm run serve`)。

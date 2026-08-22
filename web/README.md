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

- `node_modules/maplibre-gl/dist/`のESMバンドル(`maplibre-gl.mjs`・`maplibre-gl-worker.mjs`・`maplibre-gl.css`)を`public/vendor/maplibre-gl/`へコピーする。
- `src/`配下のブラウザ実行用スクリプト(`*.test.js`を除く)を`public/`へコピーする。

```bash
npm run build
```

`public/index.html`は[import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)で`"maplibre-gl"`を`./vendor/maplibre-gl/maplibre-gl.mjs`へ解決するため、`src/main.js`は通常のnpmパッケージと同じ書き方(`import { Map } from "maplibre-gl"`)でインポートできる。`public/vendor/`・`public/*.js`はビルド生成物のため.gitignore対象。

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

本番環境のホスティング先は**GitHub Pages**に決定した(design.md Decision 3参照)。GitHub Pages(Fastly/Varnish CDN経由)は静的ファイルへのHTTP Rangeリクエストを標準でサポートしており、実ファイルへの`curl -r`検証で`206 Partial Content`・正しい`Content-Range`が返ることを確認済み。`public/`配下(`cafe.pmtiles`を含む)をそのままデプロイすれば要件を満たせる。

GitHub Pagesのプロジェクトサイトは`https://<user>.github.io/<repo>/`というサブパス配下で配信されるため、`cafe.pmtiles`やフロントエンド資産の参照はこのベースパスを前提とした相対パス/URLで組み立てる必要がある(Issue #5以降のフロントエンド実装で反映する)。`server/serve.js`はローカル開発・動作確認用であり、本番配信そのものを担うことは想定していない。

## ディレクトリ構成

- `src/`: 地図初期化・レイヤ定義・ポップアップ・アイコン判定ロジックを配置する(`npm run build`で`public/`へコピーされる)。
  - `main.js`: MapLibre GL JS v6で地図を初期化し、OpenStreetMap Standardを背景地図として表示する。
- `public/`: 静的配信するHTML、アイコンスプライト、`pipeline`が生成する`cafe.pmtiles`を配置する。`vendor/`と`*.js`は`npm run build`の生成物。
- `scripts/build.js`: `npm run build`の実体(vendorアセットのコピー、`src/`スクリプトのコピー)。
- `server/serve.js`: `public/`をHTTP Range対応で配信する開発用静的サーバー(`npm run serve`)。

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

## ディレクトリ構成

- `src/`: 地図初期化・レイヤ定義・ポップアップ・アイコン判定ロジックを配置する。
- `public/`: 静的配信するHTML、アイコンスプライト、`pipeline`が生成する`cafe.pmtiles`を配置する。

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

## ディレクトリ構成

- `src/`: Overpass APIからの取得・GeoJSON変換・PMTiles変換スクリプトを配置する。

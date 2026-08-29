# cafe-map-japan

日本全国のカフェ・喫茶店 POI を地図上に表示する Web マップ。

Overture Maps Places から POI を取得して PMTiles に変換する**データパイプライン**と、
MapLibre GL JS でそれを表示する**静的 Web フロントエンド**の 2 つで構成される。

- **公開サイト**: https://hirofumikanda.github.io/cafe-map-japan/
- 背景地図: OpenStreetMap Standard(透過 50%)
- POI: Overture Maps Places(theme=places)を日本全域の bbox・カテゴリ・confidence で絞り込み
- 既知チェーン(ドトール、スターバックス等)は専用アイコンで色分け表示、絞り込みプルダウンあり

## アーキテクチャ

```
Overture Maps Places (S3 / GeoParquet)
        │  pipeline/  (DuckDB + tippecanoe)
        ▼
  cafe.geojson  ──►  cafe.pmtiles  (MVT, z10-14, source-layer: cafe)
        │
        │  web/public/cafe.pmtiles としてコミット
        ▼
   web/  (MapLibre GL JS v6, バンドラなし)
        │  npm run build → public/ を静的配信
        ▼
   GitHub Pages  (HTTP Range 対応 → PMTiles をバイト範囲取得)
```

データ更新はパイプラインをローカル実行 → `web/public/cafe.pmtiles` を差し替えてコミット、
という手動フロー。デプロイ用の GitHub Actions はパイプラインを実行しない。

## ディレクトリ構成

| パス | 役割 |
|---|---|
| `pipeline/` | Overture Places 取得 → GeoJSON → PMTiles 変換([`pipeline/README.md`](pipeline/README.md)) |
| `web/` | MapLibre GL JS フロントエンド + 開発用静的サーバー([`web/README.md`](web/README.md)) |
| `web/.claude/skills/run-cafe-map-web/` | ヘッドレス環境で地図を起動し描画確認する `/run-cafe-map-web` スキル |
| `openspec/` | [OpenSpec](https://github.com/Fission-AI/OpenSpec) の仕様・変更提案(`specs/`・`changes/`) |
| `.github/workflows/deploy-pages.yml` | `web/` をビルドして GitHub Pages へデプロイ |

## セットアップと実行

### 前提ツール

- **Node.js 18 以上**(`web` は 20 系で CI 実行)
- パイプラインのみ: **DuckDB CLI** と **tippecanoe**(npm 外。`brew install duckdb tippecanoe` 等)

### データパイプライン(`pipeline/`)

```bash
cd pipeline
npm install
OVERTURE_RELEASE=2026-08-19.0 npm run fetch   # → out/cafe.geojson
npm run build:tiles                            # → out/cafe.pmtiles
npm run verify:tiles                           # メタデータ・サンプル POI を検証
cp out/cafe.pmtiles ../web/public/cafe.pmtiles # フロントへ反映
```

詳細な環境変数・クエリ条件は [`pipeline/README.md`](pipeline/README.md) を参照。

### Web フロントエンド(`web/`)

```bash
cd web
npm install
npm run build          # vendor ESM と src/*.js を public/ へコピー
npm run serve          # http://localhost:8080/  (PORT で変更可)
```

バンドラは使わず、`public/index.html` の import map でブラウザに直接 ESM を読ませる。
`web/public/vendor/` と `web/public/*.js` はビルド生成物(gitignore 対象)。
ヘッドレス環境での描画確認は [`run-cafe-map-web` スキル](web/.claude/skills/run-cafe-map-web/SKILL.md)を使う。

## テスト

```bash
cd pipeline && npm test   # node --test  (17 tests)
cd web      && npm test   # node --test  (27 tests)
```

## デプロイ

`main` への push、または Actions からの手動実行(`workflow_dispatch`)で
`.github/workflows/deploy-pages.yml` が起動し、`web/` で `npm ci && npm run build` した
`web/public/` を GitHub Pages へ公開する。ビルド失敗時はデプロイジョブは実行されない。

初回のみ、リポジトリ Settings › Pages › Source を **GitHub Actions** に設定する手動作業が必要。

## 開発フロー(OpenSpec)

仕様駆動で開発している。変更は `openspec/changes/<name>/` に提案(proposal / spec デルタ /
design / tasks)を作成してからコード実装へ進む。

```bash
openspec list                       # 進行中の変更
openspec show <change>               # 変更の内容
openspec validate <change> --strict  # 提案の検証
```

Claude Code 用のスラッシュコマンド: `/opsx:propose`(提案作成)、`/opsx:apply`(実装)、
`/opsx:archive`(完了後のアーカイブと本仕様への同期)。

現行の本仕様(`openspec/specs/`): `cafe-map-viewer` / `cafe-poi-pipeline` / `site-deployment`。

## 1. プロジェクト基盤

- [ ] 1.1 データパイプライン用ディレクトリ(例: `pipeline/`)とフロントエンド用ディレクトリ(例: `web/`)の構成を作成する
- [ ] 1.2 必要ツール(Overpass APIクライアント実行環境、tippecanoe、pmtilesライブラリ、MapLibre GL JS v6)の依存関係を定義する

## 2. Overpass APIからのPOI取得

- [ ] 2.1 都道府県(または地方)単位でOverpass QLクエリを組み立て、`amenity=cafe`関連POIを取得する取得スクリプトを実装する
- [ ] 2.2 取得結果に`name`・`brand`・`operator`等のタグをpropertiesとして保持したままGeoJSON Featureへ変換する処理を実装する
- [ ] 2.3 クエリ失敗(タイムアウト・エラーレスポンス)時にリトライし、最終的に失敗した場合は明示的にエラー終了する処理を実装する
- [ ] 2.4 各都道府県分の結果を1つのGeoJSON FeatureCollectionにマージする処理を実装する
- [ ] 2.5 全国分を取得して生成されたGeoJSONの件数・プロパティ内容を確認する

## 3. GeoJSONからPMTilesへの変換

- [ ] 3.1 tippecanoeを用いて`--minimum-zoom=10 --maximum-zoom=14`でGeoJSONを`cafe.pmtiles`(source-layer名: `cafe`)へ変換するビルドコマンド/スクリプトを実装する
- [ ] 3.2 生成された`cafe.pmtiles`のメタデータ(minzoom=10, maxzoom=14)を検証する
- [ ] 3.3 サンプルPOI(既知の座標)がz14タイル内に含まれることを確認する

## 4. 静的配信

- [ ] 4.1 `cafe.pmtiles`とフロントエンド資産を配置する静的ホスティング環境を用意する
- [ ] 4.2 配信元がHTTP Rangeリクエスト(206 Partial Content)に対応していることを確認する

## 5. フロントエンド基盤とOSM背景地図

- [ ] 5.1 MapLibre GL JS v6を導入し、地図を初期化するHTML/JSを実装する
- [ ] 5.2 OpenStreetMap Standardのラスタータイル(`https://tile.openstreetmap.org/{z}/{x}/{y}.png`)を背景地図としてスタイルに追加し、OSM帰属表示を地図上に表示する

## 6. カフェ・喫茶店POIレイヤ

- [ ] 6.1 `pmtiles`ライブラリの`Protocol`を`maplibregl.addProtocol`に登録する
- [ ] 6.2 `pmtiles://`経由で`cafe.pmtiles`をvector sourceとしてスタイルに追加する
- [ ] 6.3 `cafe`レイヤをsymbolレイヤとして追加し、z10-14の範囲で表示・z14超過時はオーバーズームで表示されることを確認する
- [ ] 6.4 z10未満ではPOIシンボルが表示されないことを確認する

## 7. ポップアップ表示

- [ ] 7.1 POIシンボルのクリックイベントを検知し、該当Featureのプロパティ(店名・ブランド・住所等)を表示するポップアップを実装する
- [ ] 7.2 POIシンボルが存在しない場所のクリックではポップアップが表示されないことを確認する

## 8. チェーン店アイコンによる識別

- [ ] 8.1 既知チェーン名(ドトール、ベローチェ等)とアイコンIDを対応付ける拡張可能な照合テーブル(例: JSON)を作成する
- [ ] 8.2 ブランド表記ゆれ(全角/半角、法人格の有無等)を吸収する正規化・一致判定ロジックを実装する
- [ ] 8.3 各チェーン用の独自デザインアイコン(公式ロゴを複製しないオリジナルグリフ)と汎用カフェアイコンのスプライト画像を用意する
- [ ] 8.4 `brand`/`operator`/`name`プロパティに基づき`icon-image`を切り替えるMapLibreの`match`/`case`式をsymbolレイヤに設定する
- [ ] 8.5 既知チェーンPOIが専用アイコンで、未分類POIが汎用アイコンで表示されることを確認する

## 9. 動作確認

- [ ] 9.1 ローカル環境でパイプライン実行からフロントエンド表示までの一連の流れを通しで確認する
- [ ] 9.2 specs/cafe-poi-pipeline・specs/cafe-map-viewerの各シナリオを手動で確認する

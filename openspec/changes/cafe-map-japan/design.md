## Context

新規(グリーンフィールド)プロジェクト。既存コード・既存specはない。proposal.mdの通り、(1) Overpass APIからのPOI取得〜PMTiles生成までのデータパイプラインと、(2) MapLibre GL JS v6によるフロントエンドの2つを新設する。動機の詳細はproposal.md - Whyを参照。

## Goals / Non-Goals

**Goals:**
- Overpass APIを安定して叩ける取得方式を決める(全国一括クエリはタイムアウトしやすいため)
- GeoJSON→PMTiles変換に使う具体的なツールチェーンを決める
- MapLibre側でのPMTiles読み込み方式・チェーン店アイコン判定方式を決める
- OSM Standardタイル利用に伴う利用規約上の留意点を明示する

**Non-Goals:**
- POIデータの自動・定期更新(スケジューリング)の実装方式の確定(将来課題とし、まずは手動/CIから再実行可能なバッチとして設計する)
- 独自タイルサーバーの構築(背景地図はOSM Standardをそのまま利用する)
- ドトール・ベローチェ以外の全チェーンブランドのアイコンを網羅的に用意すること(拡張可能な仕組みのみ用意する)

## Decisions

### 1. Overpass APIクエリはPMTiles生成用ビルド時タスクとし、都道府県単位で分割実行する
全国を1クエリで取得すると`amenity=cafe`のヒット件数が多く、Overpass APIのデフォルトタイムアウト(180秒)や公開インスタンスのレート制限に抵触しやすい。都道府県(または地方)単位でOverpass QLクエリ(`area["ISO3166-2"="JP-xx"]["boundary"="administrative"]->.a; nwr["amenity"="cafe"](area.a);`)を分割実行し、結果をマージして1つのGeoJSON FeatureCollectionにする。各クエリ間には公開Overpassインスタンスの利用ポリシーに沿ったウェイトを入れ、失敗時はリトライする。
- 代替案: 全国一括クエリ → タイムアウト・失敗率が高く却下。
- 代替案: 独自Overpassインスタンスの構築 → 運用コストが見合わないため却下(将来必要になれば再検討)。

### 2. GeoJSON→PMTiles変換にはtippecanoeを使用し、z10-14を明示指定する
tippecanoeは`--minimum-zoom=10 --maximum-zoom=14`を指定した上で`.pmtiles`を直接出力できるため、MBTiles経由の追加変換ステップが不要。レイヤ名(source-layer)は`cafe`として固定し、フロントエンド側のスタイル定義と対応させる。
- 代替案: tippecanoeでMBTilesを生成し`pmtiles convert`でPMTiles化 → ステップが増えるため、tippecanoeが直接pmtiles出力に対応する場合はそちらを優先。

### 3. PMTilesはHTTP Range対応の静的ホスティングから配信し、フロントエンドは`pmtiles`JSライブラリのProtocolハンドラ経由で読み込む
PMTilesはクライアントがバイト範囲リクエストでタイルを取り出す方式のため、配信環境がRangeリクエストをそのまま通す(ストリップしない)ことが必須条件になる。フロントエンドでは`pmtiles`ライブラリの`Protocol`を`maplibregl.addProtocol`に登録し、MapLibreスタイルのvector sourceを`pmtiles://<配信URL>/cafe.pmtiles`として参照する。
- 代替案: 通常のMVTタイルサーバー(z/x/yごとにHTTPで配信)を別途構築 → サーバーコンポーネントが増え「静的配信」という要求から外れるため却下。

### 4. 背景地図はOpenStreetMap Standardのラスタータイルをそのまま利用する
MapLibre GL JS v6のスタイルJSONにraster sourceとして`https://tile.openstreetmap.org/{z}/{x}/{y}.png`を追加し、OSM利用規約に従い適切な帰属表示(attribution)を地図上に表示する。
- リスク: [OSM Tile Usage Policyは大量トラフィックの直接利用を禁止している](https://operations.osmfoundation.org/policies/tiles/) → Risks/Trade-offs参照。

### 5. チェーン店アイコンはブランド名の照合テーブルで判定し、独自デザインのアイコンを用いる
POIの`brand`タグ(なければ`operator`/`name`)を、既知チェーン名(例: "ドトールコーヒー" → doutor、"カフェ・ベローチェ" → veloce)の照合テーブルと突き合わせ、MapLibreの`match`/`case`式で`icon-image`を切り替える。一致しない場合は汎用カフェアイコンにフォールバックする。照合テーブルは拡張可能なデータ構造(JSON等)として持ち、新チェーンの追加を容易にする。
アイコン自体は各チェーンの公式ロゴをそのまま複製せず、色・形状で識別できる独自デザインのグリフを新規作成する(商標・ライセンス上のリスク回避のため)。

## Risks / Trade-offs

- [公開Overpassインスタンスのレート制限・タイムアウト] → 都道府県単位への分割、リトライ、リクエスト間隔の確保で緩和する。
- [OSM Standardタイルの利用規約(大量アクセス制限)に抵触しうる] → 本changeのスコープでは要求通りOSM Standardを直接利用するが、利用者数が増えた場合は自前のタイルキャッシュ/プロキシへの切り替えを別changeとして検討する前提を明記しておく。
- [PMTilesを配信する環境がRangeリクエストを正しく扱わない可能性] → specの「PMTilesの静的配信」要件でRange対応を必須化し、デプロイ先選定時に確認する。
- [チェーン店ブランド名の表記ゆれ(全角/半角、法人格の有無等)による誤判定] → 照合は正規化(トリム・全角半角統一)した上で部分一致も許容し、未知パターンは汎用アイコンに安全側でフォールバックする。
- [Overpassスナップショットの鮮度] → パイプラインは再実行可能なバッチとして設計し、リアルタイム同期は行わない前提を明記する。

## Migration Plan

グリーンフィールドのため既存システムへの移行は不要。導入手順は次の通り。
1. データパイプラインを実行し、GeoJSON生成→PMTiles変換までの成果物(`cafe.pmtiles`)を得る。
2. `cafe.pmtiles`とフロントエンド一式(HTML/JS/スタイル/アイコンアセット)を、Rangeリクエスト対応の静的ホスティング環境に配置する。
3. 動作確認後に公開する。ロールバックは配信物の差し替え(旧`cafe.pmtiles`・旧フロントエンド資産への差し戻し)のみで完結する。

## Open Questions

- 具体的な静的ホスティング先(S3/Cloudflare Pages/GitHub Pages/自前nginx等)は未確定。specは「Rangeリクエスト対応の静的配信」という振る舞い要件のみを定めており、ホスティング先の選定は実装時に決定してもspec・設計方針・タスク分解に影響しない。
- ドトール・ベローチェ以外にアイコン化する具体的なチェーン一覧は未確定。照合テーブルを拡張可能な構造にすることで、実装時・運用時に追加していける。

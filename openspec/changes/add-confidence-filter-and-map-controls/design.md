## Context

現状のパイプライン(`pipeline/src/overture-client.js`, `geojson.js`, `build-tiles.js`)はOverture Placesの`confidence`をSELECTして品質フィルタ(>=0.9)にのみ使い、GeoJSON Featureのpropertiesには含めていない。`websites`列もクエリしていない。ビューア(`web/src/main.js`)はカフェレイヤに`filter`を設定しておらず、`NavigationControl`・`hash`オプションも未使用。動作の詳細は proposal.md / specs を参照。

## Goals / Non-Goals

**Goals:**
- `confidence`・`websites`をタイルのFeature propertiesとして配信し、クライアント側で利用可能にする。
- ズームに応じたconfidenceしきい値をMapLibreのフィルタ式のみで実現し、タイル本体・タイル生成範囲(z10-14)は変更しない。
- ナビゲーションコントロールとURLハッシュ同期をMapLibre標準機能で追加する。

**Non-Goals:**
- PMTilesのズーム範囲(z10-14)自体の変更(z15以降は既存のz14タイルのオーバーズームで表示され続ける、既存仕様のまま)。
- confidenceのしきい値自体を設定可能にする(環境変数化等)。今回は固定値のハードコードでよい。

## Decisions

### Decision 1: `websites`はMVT互換のため配列のままGeoJSONに保持し、tippecanoeのJSON文字列化に委ねる
Overture Placesの`websites`はstring配列。Mapbox Vector Tile仕様のfeature propertiesはスカラー値(string/number/boolean)のみを許容するため、tippecanoeは配列/オブジェクト値を自動的にJSON文字列へシリアライズしてタイルに格納する(既存の`brand`/`categories`等のSTRUCT/LIST列をOverture Places側で`to_json()`しているのと同じ制約)。`geojson.js`では`record.websites`をそのまま(配列のまま)`properties.websites`に設定し、tippecanoe/PMTiles側のJSON文字列化に委ねる。クライアント側で配列として扱いたい場合は`JSON.parse(properties.websites)`する。
- 代替案: 最初の1件のみを`website`(単数)として文字列で保持する(既存の`address`の扱いに合わせる)。
- 不採用理由: ユーザーが明示的に「websitesプロパティ」の追加を要望しており、複数サイトを持つPOIで情報を失いたくないため、配列のまま保持する方を採用する。

### Decision 2: `overture-client.js`のSELECT列に`to_json(websites) AS websites`を追加する
`names`/`categories`/`brand`/`addresses`と同様、`websites`もLIST型のためduckdbの`-json`出力をそのまま使うと非JSON文字列になる。既存パターンに合わせて`to_json()`でラップする。`confidence`は既にSELECT済みのため変更不要。

### Decision 3: confidenceフィルタはMapLibreレイヤの`filter`式で、ズーム連動の`step`式を使う
`map.addLayer`の`filter`に、`["step", ["zoom"], 0.99, 15, 0.97, 16, 0.95, 17, 0.90]`のようなズーム依存のしきい値と`["get", "confidence"]`を組み合わせた`>=`比較式を設定する。MapLibreの`filter`はズーム依存の式(`["step", ["zoom"], ...]`や`["interpolate", ...]`)をサポートしており、ズームごとに再描画時に自動再評価されるため、JS側でズーム変化を監視して`setFilter`を呼び直す実装は不要。
- 代替案: `map.on("zoom", ...)`でJS側からしきい値を計算し`setFilter`を都度呼ぶ。
- 不採用理由: MapLibreのスタイル式のみで宣言的に完結でき、余分なイベントハンドラや再描画タイミングのバグを避けられるため。

### Decision 4: ナビゲーションコントロールは`map.addControl(new NavigationControl(), "top-right")`をmap生成直後に呼ぶ
MapLibre標準の`NavigationControl`をそのまま使用し、独自のUIは作らない。`"top-right"`はMapLibreのデフォルト位置指定文字列。

### Decision 5: URLハッシュ同期は`MapLibreMap`コンストラクタの`hash: true`オプションを使う
独自にURLを書き換えるのではなく、MapLibre組み込みの`hash`オプション(`true`)を使い、`#zoom/lat/lng/bearing/pitch`形式のハッシュを自動的に読み書きさせる。既存の`center`/`zoom`初期化オプションは、URLにハッシュが無い場合の初期表示用フォールバックとしてそのまま残す。

### Decision 6: 背景地図の透過度は`osm`レイヤの`paint.raster-opacity`で設定する
`web/src/main.js`のstyle定義中、`osm`ラスタレイヤに`paint: { "raster-opacity": 0.5 }`を追加する。ソース側(タイルURL)やレイヤ順序の変更は不要。

### Decision 7: POIラベルは`text-variable-anchor`(右優先・下フォールバック)+`text-radial-offset`で配置し、`glyphs`にdemotilesのフォントサーバーを指定する
- スタイル定義のトップレベルに`glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"`を追加する。これはMapLibre/Mapboxスタイル仕様の標準的なグリフソース指定方法で、`{fontstack}`(フォント名)・`{range}`(Unicodeコードポイント範囲)がリクエスト時に置換される。
- カフェレイヤ(`CAFE_LAYER_ID`)のlayoutに以下を追加する:
  - `text-field`: `["coalesce", ["get", "name"], ["get", "brand"], ["get", "operator"]]`(ポップアップの名称フォールバック順と同じロジック)
  - `text-font`: `["Noto Sans Regular"]`
  - `text-size`: 12
  - `text-variable-anchor`: `["right", "bottom"]`(アイコンの右を優先し、他ラベルと衝突する場合はMapLibreが自動的に下へフォールバックする)
  - `text-radial-offset`: アイコン中心からのラベル距離(em単位)。`text-variable-anchor`使用時は`text-offset`ではなく`text-radial-offset`を使う(MapLibreの仕様上の組み合わせ)。
- ラベル追加に伴い、既存の`icon-size: 0.6`を`0.5`程度へ縮小し、アイコンとラベルの合計占有面積を抑える。
- 代替案: 固定の`text-anchor`(例: 常に`"right"`または常に`"bottom"`)+`text-offset`。
- 不採用理由: 固定アンカーでは衝突時にMapLibreがラベルを非表示にするだけで再配置されず、POI密集地でラベルが大量に欠落する。`text-variable-anchor`は候補アンカーの中から衝突しない位置を自動選択するため、ユーザーが指定した「右優先・収まらなければ下」という優先順位をそのまま表現でき、ラベルの可視率も向上する。

### Decision 8: ポップアップの`confidence`・`websites`表示は`buildCafePopupHtml`にフォーマット処理を追加して行う
- `confidence`は`properties.confidence`(0〜1の数値)を`${Math.round(confidence * 100)}%`のように百分率へ変換して1行で表示する。
- `websites`はDecision 1の通りタイル上ではJSON文字列(または元がGeoJSON段階のままなら配列)として格納されているため、表示前に次のように解釈する: 既に配列であればそのまま使い、文字列であれば`JSON.parse`を試みる。パースに失敗した場合、または結果が配列でない場合は`websites`行自体を省略する(fail-safe、ポップアップ全体を壊さない)。
- 有効なURLのうち`http:`/`https:`スキームのみをリンク化対象とし、それ以外のスキーム(`javascript:`等)は表示しない(XSS対策)。各URLは既存の`escapeHtml`でエスケープした上で`<a href="…" target="_blank" rel="noopener">`として表示する。
- 代替案: `websites`を生の文字列としてそのままテキスト表示する。
- 不採用理由: ユーザーが「ポップアップに追加」を明示的に要望しており、公式サイトへの遷移という実用上の価値を持たせるためリンクとして表示する方を採用する。

### Decision 9: Overture Mapsの帰属表示は、カフェベクタソースの`attribution`プロパティに設定し、MapLibre標準のAttributionControlに委ねる
`web/src/main.js`のstyle定義中、`osm`ソースが既に`attribution: OSM_ATTRIBUTION`を持っているのと同じパターンで、カフェベクタソース(`CAFE_SOURCE_ID`)にも`attribution: OVERTURE_ATTRIBUTION`(例: `'&copy; <a href="https://overturemaps.org/" target="_blank" rel="noopener">Overture Maps Foundation</a>'`)を追加する。`MapLibreMap`は`attributionControl`をデフォルトで有効にしており、各ソースの`attribution`文字列を自動的に結合して表示するため、独自のAttributionControl設定やDOM操作は不要。
- 代替案: 固定のHTML要素を自前で地図上に配置する。
- 不採用理由: 既存の`osm`ソースの`attribution`と二重管理になり、AttributionControlのコンパクト表示/展開の挙動とも整合しない。既存パターンを踏襲する方がシンプルで一貫している。

## Risks / Trade-offs

- [既存のPMTilesにはconfidence/websitesが含まれないため、再生成(`npm run fetch` → `npm run build:tiles`)なしにビューア側のフィルタを有効化すると全POIが非表示になる] → tasks.mdでパイプライン再実行とPMTiles差し替えを明示的なタスクとして含める。
- [`websites`をJSON文字列としてタイルに格納するため、ポップアップで配列として使うには`JSON.parse`が必要になり、不正な値やパースエラーのハンドリングが要る] → Decision 8の通り、パース失敗時・非配列時は`websites`行を省略するfail-safe実装とし、ポップアップ全体の表示が壊れないようにする。
- [confidenceフィルタのしきい値はハードコードのため、将来しきい値を調整する際はコード変更が必要] → 要件として明示されている固定値であり、可変化は非ゴール。
- [`glyphs`に外部のdemotiles.maplibre.orgを指定するため、当該サーバーが利用不可・低速な場合はラベルが表示されない、または表示が遅延する新たな外部依存が生じる] → デモ/評価用途のフォントサーバーであることを認識した上での要件であり、本番運用で問題になる場合は自前ホスティングへの切り替えを別changeで検討する。

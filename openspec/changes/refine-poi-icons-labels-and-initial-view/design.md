## Context

`web/src/main.js`は現在、以下の状態になっている(詳細はproposal.md参照)。

- カフェレイヤ(`CAFE_LAYER_ID`)のlayoutで`text-variable-anchor: ["right", "bottom"]`を使用し、ラベルはアイコンの右優先・衝突時は下にフォールバックする。
- チェーン専用・汎用アイコンは、`createChainIcon()`がcanvasに図形(`circle`/`square`/`diamond`)と色を描画してその場で`ImageData`を生成し、`map.addImage()`で同期的に登録している(`CHAIN_TABLE`の各エントリが`shape`/`color`を持つ)。
- `buildCafePopupHtml()`は`confidence`(0〜1の数値)を`Math.round(confidence * 100)}%`で百分率表示している。
- `MapLibreMap`の初期化オプションは`center: [138.0, 37.0], zoom: 5`(日本全体が見渡せる広域表示)で、`hash: true`によりURLハッシュがあればそちらが優先される。

`web/public/img/`には`cup_black.png`を含む9色のカップアイコン画像(32x32 PNG)が既に配置されている(現時点でGit未追跡)。本changeはこれらの画像を使ってチェーンアイコンの表示方式を差し替える。

## Goals / Non-Goals

**Goals:**
- ラベル配置優先度をアイコン左優先・上フォールバックに変更する。
- チェーン専用・汎用アイコンをcanvas描画の図形から`public/img/`配下の画像ファイルに置き換える。
- ポップアップのconfidence表示を百分率から、丸めや変換を行わない元の数値のまま表示する形式に変更する。
- 地図の初期表示(ハッシュ無し時のフォールバック)をズームレベル10・皇居周辺に変更する。

**Non-Goals:**
- 新しいチェーンの追加・`CHAIN_TABLE`のブランド一致ロジック(`resolveChainIconId`/`buildIconImageExpression`)自体の変更は行わない。
- `public/img/`の画像アセット自体の新規作成・デザイン変更は行わない(既存ファイルをそのまま使用する)。
- confidenceによる品質フィルタやズーム連動フィルタのしきい値は変更しない。

## Decisions

### Decision 1: `text-variable-anchor`を`["left", "top"]`に変更し、`text-radial-offset`はそのまま流用する
`text-radial-offset`はアンカー方向に依存せずアイコン中心からの距離を指定する値であるため、アンカーの候補を`["right", "bottom"]`から`["left", "top"]`に入れ替えるだけで「左優先・衝突時は上にフォールバック」という要求を満たせる。既存の`text-field`/`text-font`/`text-size`/`text-optional`は変更しない。

- 代替案: `text-anchor`を固定値`"left"`にし、衝突時は非表示のままにする。
- 不採用理由: `text-optional: true`と組み合わせても、固定アンカーでは衝突時にラベルが再配置されず単に非表示になるだけで、「上にフォールバックする」という要求を満たせない。`text-variable-anchor`はMapLibreが候補アンカーの中から衝突しない位置を自動選択するため、変更後も引き続きこの仕組みを使う。

### Decision 2: チェーン・汎用アイコンは`map.loadImage()` + `map.addImage()`で`public/img/`の画像を読み込み、`CHAIN_TABLE`に画像ファイル名を持たせる
`createChainIcon()`によるcanvas描画・`ICON_DEFS`の`shape`/`color`を廃止し、代わりに次の構成にする。

- `CHAIN_TABLE`の各エントリに`image`フィールド(例: `"cup_red.png"`)を追加し、`shape`/`color`フィールドは削除する。
- `GENERIC_CAFE_ICON_ID`用の画像は`cup_black.png`とする。
- 画像は`web/public/img/<file>`から相対パスで参照する(`public/`がWebルートとして配信されるため、`img/<file>`で解決できる。design.md参照: `web/README.md`の静的配信構成)。
- 読み込みはMapLibre GL JS v6の`Map#loadImage(url): Promise<GetResourceResponse<HTMLImageElement | ImageBitmap>>`を使用し、`map.on("load", ...)`ハンドラ内で全アイコン分を`Promise.all`で並行ロードしてから`map.addImage(id, data)`で登録し、その後に`map.addLayer(...)`を呼び出す(現在の「レイヤ追加より前にアイコンを同期登録する」という設計意図を、非同期版として踏襲する)。
- 既存の`styleimagemissing`ハンドラは、スタイル再読み込み等でアイコンが未登録のまま参照された場合のフォールバックとして残すが、`map.loadImage()`のPromiseを待って`map.addImage()`する非同期実装に変更する(MapLibreは`styleimagemissing`ハンドラが後から`addImage`しても、該当シンボルを自動的に再描画する)。

- 代替案A: `<link rel="preload">`等でブラウザにプリロードさせつつ、`Image`要素+`onload`で読み込む。
- 不採用理由A: `map.loadImage()`はMapLibre公式APIで内部のリクエストキュー・キャンセル処理と統合されており、素の`Image`要素より実装が単純になる。
- 代替案B: 画像をスプライトシート化して`style.sprite`で一括指定する。
- 不採用理由B: 現状10種類程度のアイコンであれば個別`loadImage`で十分であり、スプライトシート生成のビルド手順を追加するコストに見合わない。

### Decision 3: チェーンごとの画像色は、既存の`CHAIN_TABLE.color`(ブランドカラー)に最も近い色味の`cup_*.png`を割り当てる
`public/img/`には`cup_black`(汎用専用)を除き8色(`blue`/`brown`/`green`/`orange`/`pink`/`red`/`water`/`yellow`)しかなく、`CHAIN_TABLE`には10チェーンあるため、色の重複は避けられない。既存の`color`(hexコード)を手がかりに、色相が近いものを機械的に割り当てる。

| チェーン(id) | 既存color | 割り当てるimage |
|---|---|---|
| doutor | `#c8102e`(赤) | `cup_red.png` |
| veloce | `#1b7a3d`(緑) | `cup_green.png` |
| starbucks | `#00704a`(緑がかった青緑) | `cup_water.png` |
| komeda | `#8a1c1c`(マルーン) | `cup_brown.png` |
| tullys | `#00543d`(緑) | `cup_green.png` |
| sanmarc | `#f8b400`(アンバー) | `cup_yellow.png` |
| excelsior | `#6a3d9a`(紫) | `cup_pink.png` |
| ueshima | `#b8860b`(ダークゴールデンロッド) | `cup_orange.png` |
| renoir | `#1a2b6d`(ネイビー) | `cup_blue.png` |
| becks | `#c2185b`(マゼンタ/ピンク) | `cup_pink.png` |

`veloce`/`tullys`が`green`、`excelsior`/`becks`が`pink`で重複するが、POIラベル(店名)が併記されるため識別性は損なわれない。

- 代替案: 色の重複を避けるため、一部チェーンにアイコンではなく異なる形状のバッジ等を追加する。
- 不採用理由: 画像アセットが色違いのみで用意されており、形状バリエーションの追加は本changeのスコープ(既存画像の活用)を超える。

### Decision 4: confidenceは丸め・変換を行わず、元の数値をそのまま表示する
`buildCafePopupHtml()`内の`` `信頼度: ${Math.round(confidence * 100)}%` ``を`` `信頼度: ${confidence}` ``に変更する(テンプレートリテラル内での暗黙の文字列化により、`confidence`の数値がそのまま埋め込まれる)。百分率変換・小数点以下の丸めは一切行わない。

- 代替案: `toFixed(2)`等で小数点以下を丸めて表示する。
- 不採用理由: ユーザーからの明示的な指示により、confidenceは加工せず元の値をそのまま表示することが求められているため。

### Decision 5: 地図の初期`center`/`zoom`を皇居周辺・ズームレベル10に変更する
`MapLibreMap`初期化オプションの`center`を`[139.7528, 35.6852]`(皇居、東京都千代田区)、`zoom`を`10`に変更する。`hash: true`は変更しないため、URLハッシュに地図状態が含まれる場合はそちらが優先され、この`center`/`zoom`はハッシュ無し時のフォールバックとしてのみ使われる(既存の`design.md` Decision 5の仕組みをそのまま踏襲)。

## Risks / Trade-offs

- [チェーンアイコンの読み込みが同期のcanvas描画から非同期の`map.loadImage()`に変わるため、`map.addLayer()`前に全アイコンの読み込みを`await`しないと、初回描画時にアイコン未登録のシンボルが一瞬空白になる可能性がある] → `map.on("load", ...)`内で`Promise.all`により全アイコンのロード・登録を待ってから`map.addLayer()`を呼び出す設計とし、`styleimagemissing`は保険的なフォールバックとして残す。
- [`cup_green.png`/`cup_pink.png`をそれぞれ2チェーンに割り当てるため、同色チェーンのPOIがアイコンだけでは区別できない] → POIラベル(店名)が常に併記されるため実運用上の識別性は確保されている。将来的に色の重複が問題になった場合は、新規アイコン画像の追加を別changeで検討する。
- [`public/img/`の画像ファイルは現時点でGit未追跡] → 実装タスクでコミット対象に加える。

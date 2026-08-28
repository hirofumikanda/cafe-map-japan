## Context

`web/src/main.js`は現在、以下の状態になっている(詳細はproposal.md参照)。

- カフェレイヤ(`CAFE_LAYER_ID`)のlayoutで`text-variable-anchor: ["right", "bottom"]`を使用している。MapLibre GL JSの`text-anchor`はアンカー点に最も近づけるテキスト側の基準辺を指定するプロパティであり、テキストは基準辺と逆方向に伸びるため、`"right"`は実際にはアイコンの**左**、`"bottom"`はアイコンの**上**にラベルを表示する(詳細はDecision 1参照)。つまり変更前のコードは、実際には「アイコンの左優先・衝突時は上にフォールバック」という表示になっている。
- チェーン専用・汎用アイコンは、`createChainIcon()`がcanvasに図形(`circle`/`square`/`diamond`)と色を描画してその場で`ImageData`を生成し、`map.addImage()`で同期的に登録している(`CHAIN_TABLE`の各エントリが`shape`/`color`を持つ)。
- `buildCafePopupHtml()`は`confidence`(0〜1の数値)を`Math.round(confidence * 100)}%`で百分率表示している。
- `MapLibreMap`の初期化オプションは`center: [138.0, 37.0], zoom: 5`(日本全体が見渡せる広域表示)で、`hash: true`によりURLハッシュがあればそちらが優先される。

`web/public/img/`には`cup_black.png`(汎用)を含む12色のカップアイコン画像(32x32 PNG)が配置されている。本changeはこれらの画像を使ってチェーンアイコンの表示方式を差し替える。

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

### Decision 1: `text-variable-anchor`の値と実際の表示方向の対応関係、および本changeでの扱い

MapLibre GL JSの`text-anchor`/`text-variable-anchor`は「アンカー点(アイコン位置+`text-radial-offset`による移動先)に最も近づけるテキスト側の基準辺」を指定するプロパティであり、テキストはその基準辺からアンカー点の反対方向へ伸びる。そのため、値の名前が示す方向と実際にラベルが表示される方向は逆になる。

ローカルサーバー上でPlaywright(ヘッドレスChromium)を用いて単一POIをアンカー値ごとに孤立表示させ実測した結果、対応関係は次の通りであることを確認した(Issue #65 / PR #70実装時の検証)。

| anchor値 | 基準辺 | 実際のラベル表示方向 |
|---|---|---|
| `"left"` | テキストの左辺をアンカー点に一致させる | アイコンの**右** |
| `"right"` | テキストの右辺をアンカー点に一致させる | アイコンの**左** |
| `"top"` | テキストの上辺をアンカー点に一致させる | アイコンの**下** |
| `"bottom"` | テキストの下辺をアンカー点に一致させる | アイコンの**上** |

この対応関係に基づくと、変更前のコード`text-variable-anchor: ["right", "bottom"]`は、旧版のdesign.md/proposal.mdに記載していた「アイコンの右優先・衝突時は下にフォールバック」ではなく、実際には**「アイコンの左優先・衝突時は上にフォールバック」**という表示になっていた。これはspec.mdの新Requirement「POIラベルの配置」が求める挙動と一致しており、変更前のコードは既にこの要求を満たしていたことになる。

**本changeでは、tasks.md 1.1の記述通り`text-variable-anchor`を`["left", "top"]`に変更する実装をIssue #65(PR #70)で完了させた。** しかし上記の対応関係により、この変更を適用すると実際の表示は**「アイコンの右優先・衝突時は下にフォールバック」**となり、spec.mdの新Requirement(左優先・上フォールバック)とは逆の結果になる。この矛盾は実装時に判明し、変更のオーナーに確認の上、「tasks.md 1.1の記述通りに実装する」方針として明示的に許容された(詳細はPR #70参照)。spec.mdの要求通りの見た目(左優先・上フォールバック)を得るには、`text-variable-anchor`を変更前の値`["right", "bottom"]`のまま維持する必要がある。

既存の`text-field`/`text-font`/`text-size`/`text-optional`は変更しない。`text-radial-offset`はアンカー方向に依存せずアイコン中心からの距離を指定する値であるため、いずれのアンカー値の組み合わせでも流用できる。

- 代替案: `text-anchor`を固定値`"right"`にし、衝突時は非表示のままにする。
- 不採用理由: `text-optional: true`と組み合わせても、固定アンカーでは衝突時にラベルが再配置されず単に非表示になるだけで、「上にフォールバックする」という要求を満たせない。`text-variable-anchor`はMapLibreが候補アンカーの中から衝突しない位置を自動選択するため、この仕組みを使う。

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

### Decision 3: チェーンごとに固有の`cup_*.png`を1枚ずつ割り当てる
`public/img/`には`cup_black`(汎用専用)を除き、`blue`/`brown`/`darkbrown`/`darkred`/`gold`/`green`/`orange`/`pink`/`red`/`water`/`yellow`の11色のカップ画像がある。`CHAIN_TABLE`の10チェーンそれぞれに、重複しないよう固有の画像を1枚ずつ割り当てる(変更のオーナー指定による対応)。

| チェーン(id) | 割り当てるimage |
|---|---|
| doutor | `cup_yellow.png` |
| veloce | `cup_red.png` |
| starbucks | `cup_green.png` |
| komeda | `cup_orange.png` |
| tullys | `cup_gold.png` |
| sanmarc | `cup_darkred.png` |
| excelsior | `cup_blue.png` |
| ueshima | `cup_brown.png` |
| renoir | `cup_darkbrown.png` |
| becks | `cup_pink.png` |

全チェーンに固有の画像が割り当たるため、アイコンだけでチェーンを区別できる(`cup_water.png`はいずれのチェーンにも割り当てず、汎用は引き続き`cup_black.png`)。

- 代替案: 既存のブランドカラー(`CHAIN_TABLE.color`)に色相が近い画像を機械的に割り当てる。
- 不採用理由: 用意されている画像色数がチェーン数を下回っていた当初は色の重複が避けられなかったが、画像アセットが追加され全チェーンに固有色を割り当てられるようになったため、変更のオーナー指定の対応表を採用する。

### Decision 4: confidenceは丸め・変換を行わず、元の数値をそのまま表示する
`buildCafePopupHtml()`内の`` `信頼度: ${Math.round(confidence * 100)}%` ``を`` `信頼度: ${confidence}` ``に変更する(テンプレートリテラル内での暗黙の文字列化により、`confidence`の数値がそのまま埋め込まれる)。百分率変換・小数点以下の丸めは一切行わない。

- 代替案: `toFixed(2)`等で小数点以下を丸めて表示する。
- 不採用理由: ユーザーからの明示的な指示により、confidenceは加工せず元の値をそのまま表示することが求められているため。

### Decision 5: 地図の初期`center`/`zoom`を皇居周辺・ズームレベル10に変更する
`MapLibreMap`初期化オプションの`center`を`[139.7528, 35.6852]`(皇居、東京都千代田区)、`zoom`を`10`に変更する。`hash: true`は変更しないため、URLハッシュに地図状態が含まれる場合はそちらが優先され、この`center`/`zoom`はハッシュ無し時のフォールバックとしてのみ使われる(既存の`design.md` Decision 5の仕組みをそのまま踏襲)。

## Risks / Trade-offs

- [チェーンアイコンの読み込みが同期のcanvas描画から非同期の`map.loadImage()`に変わるため、`map.addLayer()`前に全アイコンの読み込みを`await`しないと、初回描画時にアイコン未登録のシンボルが一瞬空白になる可能性がある] → `map.on("load", ...)`内で`Promise.all`により全アイコンのロード・登録を待ってから`map.addLayer()`を呼び出す設計とし、`styleimagemissing`は保険的なフォールバックとして残す。
- [チェーン数(10)に対して十分な色数の画像アセットが必要] → `cup_darkbrown`/`cup_darkred`/`cup_gold`の画像追加により、全10チェーンへ固有色を1枚ずつ割り当てられるようになった(Decision 3)。
- [`public/img/`の画像ファイルは現時点でGit未追跡] → 実装タスクでコミット対象に加える。
- [Decision 1で判明した通り、`text-variable-anchor: ["left", "top"]`への変更(Issue #65 / PR #70で実装済み)は、spec.mdの新Requirement「POIラベルの配置」(左優先・上フォールバック)とは逆の見た目(右優先・下フォールバック)になる] → 変更のオーナー確認の上、tasks.md 1.1の記述通りに実装する方針を採用済み。spec.md通りの見た目に揃える場合は、別途`text-variable-anchor`を`["right", "bottom"]`に戻す変更が必要(未実施)。

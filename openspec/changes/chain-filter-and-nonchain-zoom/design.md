## Context

動機は proposal.md - Why を参照。現状の関連実装は以下(`web/src/main.js` / `web/src/chains.js`)。

- カフェレイヤ(`CAFE_LAYER_ID`)は単一のsymbolレイヤで、`minzoom: 10`(`CAFE_LAYER_MIN_ZOOM`)、`filter: CAFE_CONFIDENCE_FILTER` を持つ。`CAFE_CONFIDENCE_FILTER` は `[">=", ["get","confidence"], ["step", ["zoom"], 0.99, 15, 0.97, 16, 0.95, 17, 0.9]]` で、**フィルタ式内で `["zoom"]` を使う実績が既にある**。
- チェーン判定は `chains.js` の `buildIconImageExpression()` が担う。`brand`/`operator`/`name` を `concat` した文字列に対し、`CHAIN_TABLE` 各エントリの `matchKeys` を `["in", key, searchText]` で部分一致判定する `["case", ...]` 式を返す(NFKC正規化はスタイル式では行わない、という既存の割り切り)。
- コントロールは `map.addControl(new NavigationControl(), "top-right")` のみ。`web/public/index.html` の `<style>` は地図の全画面化のみ。
- `hash: true` により地図の中心・ズーム・回転・傾きはURLハッシュに同期される。

## Goals / Non-Goals

**Goals:**
- チェーン判定ロジックを1か所(`chains.js`)に集約し、アイコン式・フィルタ式・プルダウン選択肢で共有する。
- カフェレイヤの `filter` を、confidenceフィルタ・チェーン/非チェーンのズーム出し分け・プルダウン選択の3条件を合成した式にし、選択変更時は `map.setFilter()` の呼び直しだけで反映する(レイヤ再作成なし)。
- プルダウンはネイティブ `<select>` をベースにし、閉じた状態の見た目のみをカスタムして地図コントロールと調和させる。

**Non-Goals:**
- `matchKeys` の一致ロジック自体の変更(NFKC正規化のスタイル式対応等)は行わない。
- プルダウン選択状態のURLハッシュ/localStorage への永続化は行わない(リロードで「すべて」に戻る)。
- 「チェーン店以外のみ」を選ぶ選択肢は用意しない(proposal の選択肢定義に従う)。
- 新しいチェーンの追加、`public/img/` のアイコン変更は行わない。

## Decisions

### Decision 1: チェーンIDを返すスタイル式ビルダー `buildChainIdExpression()` を `chains.js` に追加する

`buildIconImageExpression()` と同じ `searchText`(`brand`+`operator`+`name` の `concat`)・同じ `matchKeys` 部分一致判定を使い、一致したチェーンの `id`(例: `"starbucks"`)を返し、どれにも一致しなければ空文字列 `""` を返す `["case", ...]` 式を返す。

- `searchText` 生成と「チェーンごとの一致条件」組み立ては両ビルダーで共通のヘルパー(例: `chainMatchCondition(chain)`)に切り出し、二重メンテを防ぐ。
- `buildIconImageExpression()` はこのヘルパーを使う形にリファクタするが、返り値(iconId列/末尾フォールバック)と評価順序は不変に保つ。既存テスト `buildIconImageExpression produces a case expression ending in the generic icon` はそのまま通ること。

この式を使い、レイヤ側で「チェーン店か否か」は `["!=", buildChainIdExpression(), ""]`、「特定チェーンか」は `["==", buildChainIdExpression(), "<id>"]` で判定できる。

- 代替案: `buildIconImageExpression` の返り値(iconId)を流用し、`GENERIC_CAFE_ICON_ID` かどうかで非チェーン判定する。
- 不採用理由: 特定チェーン絞り込みには「どのチェーンか」を表す安定した値(`id`)が必要で、iconId(`chain-*`)経由より、プルダウンの `value` と直接一致させられる `id` を返す専用ビルダーの方が意図が明確。

### Decision 2: カフェレイヤの `filter` は `buildCafeFilter(selectedValue)` で組み立て、選択変更時に `map.setFilter()` する

```
buildCafeFilter(selectedValue):
  base = CAFE_CONFIDENCE_FILTER            // 常に適用
  if selectedValue === "all":
    scope = ["any",
              ["!=", chainIdExpr, ""],     // チェーン店は z10 以上(レイヤ minzoom)
              [">=", ["zoom"], 14]]         // チェーン店以外は z14 以上
  else:
    scope = ["==", chainIdExpr, selectedValue]   // 当該チェーンのみ(ズーム出し分けなし)
  return ["all", base, scope]
```

- `map.on("load")` でレイヤ追加時に `buildCafeFilter("all")` を初期フィルタとして設定する。
- プルダウンの `change` で `map.setFilter(CAFE_LAYER_ID, buildCafeFilter(value))` を呼ぶ。レイヤ・ソース・アイコンには一切触れない。
- レイヤの `minzoom: 10` は据え置き。特定チェーン選択時に z10〜13 でも当該チェーンが出るのは「レイヤは z10 から」「`scope` にズーム条件が無い」ことで自然に満たされる。

- 代替案A: チェーン店用・非チェーン店用の2レイヤに分割し、`minzoom` を 10 / 14 で分ける。
- 不採用理由A: クリック・hover・ラベル衝突・アイコン式の設定が二重になり、プルダウン絞り込みでも両レイヤに `setFilter` が要る。単一レイヤ+合成フィルタの方が変更が局所的。
- 代替案B: フィルタ式内で `["zoom"]` を避け、`map.on("zoom")` で JS 側から `setFilter` を張り替える。
- 不採用理由B: 既存 `CAFE_CONFIDENCE_FILTER` が既にフィルタ内 `["zoom"]` を使っており、それに倣うのが一貫する。zoomイベント毎の再評価は不要。

### Decision 3: プルダウンは MapLibre の `IControl` として `top-left` に追加する

`onAdd(map)` が `<div class="maplibregl-ctrl chain-filter-ctrl">` を生成し、その中に視覚的に隠した `<label>`(`for` 紐付け、スクリーンリーダー用)と `<select>` を置く。`map.addControl(control, "top-left")` で登録する。

- 既存の `NavigationControl` と同じ追加方式で、MapLibre のコントロールスタックに乗る(`top-left` の縦積みに参加)。
- コントロールコンテナ上の `mousedown` / `dblclick` / `wheel` / `touchstart` の伝播を止め、地図のドラッグ・ズームジェスチャと干渉させない。

- 代替案: `index.html` に絶対配置の `<div>` を置き `#map` に重ねる。
- 不採用理由: z-index・位置・他コントロールとの重なりを自前管理する必要があり、MapLibre のレイアウトから外れる。

### Decision 4: ネイティブ `<select>` を使い、閉じた状態のみをカスタムスタイルする

`<select>` に `appearance: none` を当て、背景色・角丸(例 8px)・微妙なシャドウ/ボーダー・右側にSVGシェブロン(background-image data URI)・十分なタップ領域(高さ 40px 以上、`font-size: 16px` で iOS の自動ズーム回避)・`:focus-visible` のフォーカスリング・ホバー状態を定義する。ライト前提の地図UIに合わせた配色にする。

- 開いた状態(選択肢リスト)は OS ネイティブのピッカーに委ねる。これはタッチ操作で最も扱いやすく、キーボード操作・スクリーンリーダー対応が標準で得られる。
- CSS は `web/public/index.html` の `<style>` に追記する(このプロジェクトは専用CSSファイルを持たず、`public/` を直接配信するため)。

- 代替案: `<div role="listbox">` ベースの完全カスタムドロップダウン。
- 不採用理由: フォーカストラップ・タッチスクロール・ARIA・外側クリック閉じ等を自前実装するコストが、「PC/スマホで操作が容易」という要件に対して見合わない。ネイティブ `<select>` + カスタム外観で「洗練されたモダン」は十分達成できる。

### Decision 5: プルダウン選択肢は `chains.js` から導出してエクスポートする

`CHAIN_FILTER_OPTIONS = [{ value: "all", label: "すべて" }, ...CHAIN_TABLE.map(c => ({ value: c.id, label: c.label }))]` を `chains.js` からエクスポートし、コントロールはこれを `<option>` に展開する。チェーン追加時に `CHAIN_TABLE` へ1件足すだけでプルダウンにも反映される(既存の設計方針を踏襲)。

## Risks / Trade-offs

- フィルタ式内 `["zoom"]` はタイルのオーバースケール境界(整数ズーム付近)でのみ再評価される既知の癖があり、z14 境界でチェーン店以外の表示切替に微小な遅延が出うる → 既存 confidence フィルタと同じ挙動で、実用上許容。厳密な境界が要る要件ではない。
- ネイティブ `<select>` の開いた状態は OS 依存で見た目を制御できない → 意図的に閉じた状態のみカスタムする方針(Decision 4)。操作性はむしろ向上する。
- `buildIconImageExpression` のリファクタで評価順序が変わるとアイコン割り当てが変化するリスク → 共通ヘルパー化は条件生成のみに留め、`["case"]` への push 順(= `CHAIN_TABLE` 順)と末尾フォールバックは不変に保ち、既存テストで担保する。
- コントロールDOMがマップジェスチャを奪う可能性 → コンテナでポインタ/ホイール系イベントの伝播を停止(Decision 3)。
- 特定チェーン選択中にそのチェーンのPOIが視界内に無いと「絞り込んだのに何も出ない」体験になりうる → 仕様通りの挙動。ラベル文言で選択中チェーンが明確なため許容(将来、件数表示や自動フィットは別change)。

## Open Questions

なし。

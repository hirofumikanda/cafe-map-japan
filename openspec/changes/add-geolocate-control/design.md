## Context

`web/src/main.js`は`new MapLibreMap({...})`でマップを生成し、`NavigationControl`(右上)・`ChainFilterControl`(左上)を`addControl`している。帰属表示はMapLibreが生成時に自動追加する`AttributionControl`が担い、`style.sources`の`osm.attribution`(OSM)・`cafe.attribution`(Overture)を集約して右下に表示している。現状、現在地表示の手段は無い。

MapLibre GL JS v6には標準の`GeolocateControl`があり、Geolocation APIのラップ・現在地マーカー描画・追従モードのUIを提供する。追加のnpm依存やCSSは不要(`maplibre-gl.css`にボタンスタイルを含む)。

右下コーナーのコントロールは`.maplibregl-ctrl-bottom-right .maplibregl-ctrl { float: right; clear: both }`で、DOMへの追加順に上から下へ積み上がる。自動`AttributionControl`は`Map`コンストラクタ内で最初に追加されるため、後から`bottom-right`へ追加したコントロールは帰属表示の**下**に来る。

## Goals / Non-Goals

**Goals:**
- 標準`GeolocateControl`を右下、帰属表示ボタンの上に配置する。
- 帰属表示(OSM / Overture のクレジット)を現状と同じ内容・同じコーナーで維持する。

**Non-Goals:**
- 現在地マーカーの見た目や追従挙動のカスタマイズ。
- 現在地の永続化・URLハッシュ連携・初期表示位置としての利用(初期表示は皇居のまま)。
- 位置情報の許可状態に応じた独自UI(トースト等)の追加。MapLibre標準の挙動に委ねる。

## Decisions

### Decision: 自動attributionを無効化し、`GeolocateControl` → `AttributionControl`の順で明示追加する
`Map`生成オプションに`attributionControl: false`を追加し、`map.addControl(new GeolocateControl(...), "bottom-right")`、続けて`map.addControl(new AttributionControl(), "bottom-right")`を呼ぶ。右下コーナーではDOM追加順に上から積まれるため、Geolocateボタンが帰属表示ボタンの上に配置される。`AttributionControl`は引数なしで生成し、`style.sources`の`attribution`集約・コンパクト表示のレスポンシブ挙動は従来どおり得る。

- **代替案1: 自動attributionのまま`GeolocateControl`を`bottom-right`に追加** — 実装は1行で済むが、Geolocateボタンが帰属表示の下に来て要件(帰属表示ボタンの上)を満たさない。却下。
- **代替案2: `GeolocateControl`を`bottom-left`など別コーナーへ配置** — 「帰属表示ボタンの上」という位置関係が崩れ、左下は将来の凡例等と競合しうる。却下。
- **代替案3: CSSで`flex-direction: column-reverse`等を当てて自動attributionの順序を反転** — グローバルなコントロール配置に副作用があり、MapLibre内部のDOM構造前提に依存する。明示追加の方が意図が明確。却下。

### Decision: `GeolocateControl`のオプション
```js
new GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  showUserLocation: true,
})
```
`trackUserLocation: true`で、初回押下時に現在地へ`flyTo`し追従モードに入る/再押下で解除、という標準UIを使う。`showUserLocation: true`(既定)で現在地マーカーと精度円を描画する。`enableHighAccuracy: true`はモバイルでの現在地精度を優先する。

- **代替案: `trackUserLocation: false`** — 1回だけ現在地へ移動しマーカーを出す最小挙動。追従が不要なら十分だが、地図を動かした後に現在地へ戻る操作が毎回同じ体験にならない。追従ありの方が「現在地を表示し続ける」用途に合う。

### Decision: エラー処理はMapLibre標準に委ねる
権限拒否・取得失敗時、`GeolocateControl`は`error`イベントを発火しボタンを非アクティブ表示に戻す。独自のエラーUIは追加しない。Geolocation API非対応環境では`GeolocateControl`自身がボタンを表示しない(またはdisabled)。`main.js`側で`error`を`console.warn`する程度に留める。

## Risks / Trade-offs

- **[セキュアコンテキスト必須] Geolocation APIはHTTPSまたはlocalhostでのみ動作する** → 本番のGitHub Pagesはhttps、ローカルは`npm run serve`(localhost)で条件を満たす。file://直開きでは動かない旨をタスクの動作確認で意識する。
- **[自動attribution無効化の副作用] `attributionControl: false`にすると、明示追加を忘れると帰属表示が消える** → 同じ関数内で必ず`AttributionControl`を追加し、動作確認およびspecのシナリオ「帰属表示が維持される」で担保する。
- **[コンパクト表示の初期状態] 手動追加の`AttributionControl`は`compact`未指定時、地図幅で自動判定** — 従来の自動追加と同じ挙動のため実質差分なし。必要なら将来`{ compact: true }`を検討。
- **[ヘッドレス確認の限界] Playwright/Chromiumでは実際の位置情報は得られない** → 目視確認はボタンの存在・配置(帰属表示の上)・押下でエラーにならないこと、までを対象とする。

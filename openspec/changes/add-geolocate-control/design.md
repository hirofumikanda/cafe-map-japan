## Context

`web/src/main.js`は`new MapLibreMap({...})`でマップを生成し、`NavigationControl`(右上)・`ChainFilterControl`(左上)を`addControl`している。帰属表示はMapLibreが生成時に自動追加する`AttributionControl`が担い、`style.sources`の`osm.attribution`(OSM)・`cafe.attribution`(Overture)を集約して右下に表示している。現状、現在地表示の手段は無い。

MapLibre GL JS v6には標準の`GeolocateControl`があり、Geolocation APIのラップ・現在地マーカー描画・追従モードのUIを提供する。追加のnpm依存やCSSは不要(`maplibre-gl.css`にボタンスタイルを含む)。

MapLibreの`map.addControl(control, position)`は、`position`が下辺(`bottom-*`)の場合コントロール要素をコーナーコンテナの**先頭**へ挿入する(`insertBefore(container.firstChild)`)。コンテナは`.maplibregl-ctrl-bottom-right .maplibregl-ctrl { float: right; clear: both }`で上から下へ積まれるため、**後から**`bottom-right`へ追加したコントロールほど上に配置される。自動`AttributionControl`は`Map`コンストラクタ内で最初に追加されるので、その後に`bottom-right`へ追加したコントロールは帰属表示ボタンの**上**に来る。

## Goals / Non-Goals

**Goals:**
- 標準`GeolocateControl`を右下、帰属表示ボタンの上に配置する。
- 帰属表示(OSM / Overture のクレジット)を現状と同じ内容・同じコーナーで維持する。

**Non-Goals:**
- 現在地マーカーの見た目や追従挙動のカスタマイズ。
- 現在地の永続化・URLハッシュ連携・初期表示位置としての利用(初期表示は皇居のまま)。
- 位置情報の許可状態に応じた独自UI(トースト等)の追加。MapLibre標準の挙動に委ねる。

## Decisions

### Decision: 自動attributionはそのままに、`GeolocateControl`を`bottom-right`へ追加する
`Map`生成オプションは変更せず(自動`AttributionControl`をそのまま使う)、`NavigationControl`追加の近くで`map.addControl(geolocateControl, "bottom-right")`を1回呼ぶ。MapLibreは下辺コーナーへの追加時に要素をコンテナ先頭へ挿入するため、コンストラクタで先に追加されている帰属表示ボタンの上にGeolocateボタンが配置される。帰属表示の内容(`customAttribution`の"MapLibre"リンク + `style.sources`集約のOSM / Overture)とコンパクト表示は自動追加のまま変わらない。

> 補足: 当初の設計では「下辺コーナーは追加順に上から積まれる」と誤認し、`attributionControl: false` + `GeolocateControl` → `AttributionControl`の明示追加を採用していた。実装時にMapLibre v6の`addControl`が`bottom-*`で`insertBefore(firstChild)`することを確認し、単純な後追い1回追加へ変更した(#92)。

- **代替案1: `attributionControl: false` + `AttributionControl` → `Geolocate`の順で明示追加** — 挙動は同じにできるが、`AttributionControl`引数なし生成が既定と同一とはいえ生成コードを二重に持つことになり、明示追加を誤ると帰属表示が消えるリスクが残る。自動追加を活かす方が安全で短い。却下。
- **代替案2: `GeolocateControl`を`bottom-left`など別コーナーへ配置** — 「帰属表示ボタンの上」という位置関係が崩れ、左下は将来の凡例等と競合しうる。却下。
- **代替案3: CSSで`.maplibregl-ctrl-bottom-right`の順序を反転** — グローバルなコントロール配置に副作用があり、MapLibre内部のDOM構造前提に依存する。却下。

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
- **[MapLibreの内部挙動依存] Geolocateが帰属表示の上に来るのは`addControl`が`bottom-*`で`insertBefore(firstChild)`する実装に依存する** → MapLibre v6 (6.5.0) で確認済み。メジャーバージョン更新時はスクリーンショットで配置を再確認する。specのシナリオ「Geolocateコントロールが帰属表示ボタンより上に配置される」で担保する。
- **[ヘッドレス確認の限界] Playwright/Chromiumでは実際の位置情報は得られない** → 目視確認はボタンの存在・配置(帰属表示の上)・押下でエラーにならないこと、までを対象とする。

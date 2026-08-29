## 1. Geolocateコントロールの実装

<!-- GitHub Issue: #92 -->

- [ ] 1.1 `web/src/main.js`の`maplibre-gl` importに`GeolocateControl`と`AttributionControl`を追加する
- [ ] 1.2 `new MapLibreMap({...})`のオプションに`attributionControl: false`を追加する
- [ ] 1.3 `NavigationControl`追加箇所の近くで、`map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true }), "bottom-right")` を追加する
- [ ] 1.4 続けて `map.addControl(new AttributionControl(), "bottom-right")` を追加し、Geolocateボタンが帰属表示ボタンの上に来る順序にする
- [ ] 1.5 追加順(Geolocate → Attribution)と`attributionControl: false`の意図(帰属表示ボタンの上にGeolocateを配置するため)を説明するコメントを design.md の決定番号とともに追記する
- [ ] 1.6 `error`イベントで`console.warn`する程度の最小ハンドリングを付ける(独自エラーUIは追加しない)

## 2. 動作確認

<!-- GitHub Issue: #93 -->

- [ ] 2.1 `cd web && npm test` が通ることを確認する
- [ ] 2.2 `cd web && npm run build` が成功することを確認する
- [ ] 2.3 `npm run serve` でマップを開き、右下にGeolocateボタンが表示され、帰属表示ボタンより上に配置されていることを目視確認する
- [ ] 2.4 帰属表示にOpenStreetMapおよびOverture Maps Foundationのクレジットが従来どおり表示されることを確認する
- [ ] 2.5 Geolocateボタンを押下してもJSエラーで地図が壊れないこと、ナビゲーションコントロール・チェーン絞り込み・POIポップアップが従来どおり動作することを確認する

## 3. 仕様の反映

<!-- GitHub Issue: #92 -->

- [ ] 3.1 `openspec validate add-geolocate-control --strict` が通ることを確認する

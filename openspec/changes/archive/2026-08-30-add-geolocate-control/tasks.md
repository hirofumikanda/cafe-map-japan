## 1. Geolocateコントロールの実装

<!-- GitHub Issue: #92 -->

- [x] 1.1 `web/src/main.js`の`maplibre-gl` importに`GeolocateControl`を追加する
- [x] 1.2 自動追加の`AttributionControl`はそのまま残す(`Map`生成オプションは変更しない)
- [x] 1.3 `NavigationControl`追加箇所の近くで、`map.addControl(new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserLocation: true }), "bottom-right")` を追加する
- [x] 1.4 MapLibreが下辺コーナーへの`addControl`で要素をコンテナ先頭へ挿入するため、後追い追加のGeolocateボタンが帰属表示ボタンの上に来ることを確認する
- [x] 1.5 自動attributionを活かして後から`bottom-right`へ追加する意図・MapLibreの挿入挙動への依存を説明するコメントを design.md の決定とともに追記する
- [x] 1.6 `error`イベントで`console.warn`する程度の最小ハンドリングを付ける(独自エラーUIは追加しない)

## 2. 動作確認

<!-- GitHub Issue: #93 -->

- [x] 2.1 `cd web && npm test` が通ることを確認する
- [x] 2.2 `cd web && npm run build` が成功することを確認する
- [x] 2.3 `npm run serve` でマップを開き、右下にGeolocateボタンが表示され、帰属表示ボタンより上に配置されていることを目視確認する
- [x] 2.4 帰属表示にOpenStreetMapおよびOverture Maps Foundationのクレジットが従来どおり表示されることを確認する
- [x] 2.5 Geolocateボタンを押下してもJSエラーで地図が壊れないこと、ナビゲーションコントロール・チェーン絞り込み・POIポップアップが従来どおり動作することを確認する

## 3. 仕様の反映

<!-- GitHub Issue: #92 -->

- [x] 3.1 `openspec validate add-geolocate-control --strict` が通ることを確認する

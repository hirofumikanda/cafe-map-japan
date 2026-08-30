## Why

現状のマップにはユーザーの現在地を地図上に示す手段がなく、外出先で「今いる場所の周辺のカフェ」を確認したいときに、手動でパン・ズームして現在地を探す必要がある。MapLibre標準のGeolocateコントロールを追加することで、ワンタップで現在地へ移動・表示できるようにする。

## What Changes

- MapLibre標準の`GeolocateControl`を地図の右下(`bottom-right`)に追加し、ユーザーの現在地取得と地図上への現在地マーカー表示を可能にする。
- Geolocateコントロールは帰属表示(attribution)ボタンの**上**に配置する。MapLibreは下辺コーナーへの`addControl`時に要素をコンテナ先頭へ挿入するため、自動追加の帰属表示はそのままに、`GeolocateControl`を後から`bottom-right`へ追加するだけで帰属表示ボタンの上に配置される。
- attributionの表示内容(MapLibre / OpenStreetMap / Overture Maps Foundationへのクレジット)は変更しない。ナビゲーションコントロール(右上)・チェーン絞り込みプルダウン(左上)・POI表示ロジックも変更しない。

## Capabilities

### New Capabilities

(なし)

### Modified Capabilities

- `cafe-map-viewer`: 「現在地表示コントロールの表示」要件を新規追加する(ADDED)。Geolocateコントロールを右下・帰属表示ボタンの上に配置すること、現在地取得の成功/失敗時の挙動、コントロール追加後もOSM/Overtureのクレジットが維持されることを規定する。

## Impact

- `web/src/main.js`: `maplibre-gl`から`GeolocateControl`を追加import。`GeolocateControl`を`bottom-right`へ`addControl`し、`error`イベントを最小ハンドリングする。
- `openspec/specs/cafe-map-viewer/spec.md`: 上記要件の同期(archive時)。
- ブラウザのGeolocation API(セキュアコンテキスト/HTTPSまたはlocalhostが前提)を利用する。新規npm依存やタイル生成への影響はなし。

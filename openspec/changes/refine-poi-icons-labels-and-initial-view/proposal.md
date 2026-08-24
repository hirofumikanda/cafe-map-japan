## Why

現状のビューアには、実運用に向けて調整したい細かな表示上の課題がいくつか残っている。POIラベルの配置(右優先)がアイコンとやや重なって見づらい、チェーンアイコンがcanvas描画の図形+色のみで視認性・拡張性に乏しい、confidenceがポップアップで百分率表示になっており生の信頼度スコアとして扱いにくい、初期表示が日本全体の広域(z5)でユーザーが目的の地域までズームする手間がある、といった点をまとめて改善する。

## What Changes

- POIラベルの配置優先度(`text-variable-anchor`)を`["right", "bottom"]`から`["left", "top"]`に変更し、アイコンの左を優先、衝突時はアイコンの上にフォールバックするようにする。
- チェーン専用・汎用のPOIアイコンを、canvasで動的生成する図形+色から`web/public/img/`配下の画像ファイル(`cup_*.png`)に変更する。汎用アイコン(`GENERIC_CAFE_ICON_ID`)には`cup_black.png`を用い、既知チェーンには`cup_black.png`以外の色違い画像から、既存のブランドカラー(`CHAIN_TABLE`の`color`)に近い色を選んで割り当てる。
- ポップアップの`confidence`表示を、百分率(例: `98%`)から、丸めや変換を行わず元の数値をそのまま表示する形式に変更する。
- 地図の初期表示(URLハッシュ未指定時のフォールバック)を、ズームレベル5・日本全体表示からズームレベル10・皇居(東京都千代田区)周辺表示に変更する。

## Capabilities

### New Capabilities
(なし)

### Modified Capabilities
- `cafe-map-viewer`: POI名ラベルの配置優先度(左優先・上フォールバック)、チェーン店アイコンを画像ベースの表示に変更、POIクリック時のポップアップにおけるconfidenceの表示形式(百分率→元の数値のまま表示)、地図の初期表示位置(ズームレベル10・皇居周辺)の要件を追加・変更する。

## Impact

- `web/src/main.js`: カフェレイヤの`layout`の`text-variable-anchor`を変更。アイコン登録処理(`registerCafeIcons`/`createChainIcon`/`styleimagemissing`ハンドラ)をcanvas描画から`public/img/`配下の画像読み込み(`map.loadImage`+`map.addImage`)に置き換え。`buildCafePopupHtml`のconfidence表示ロジックを変更。`MapLibreMap`初期化オプションの`center`/`zoom`を変更。
- `web/src/chains.js`: `CHAIN_TABLE`の各エントリに、表示する画像ファイル名を指すフィールド(例: `icon`)を追加(または`shape`/`color`から置き換え)。`GENERIC_CAFE_ICON_ID`用の画像ファイル名も定義。
- `web/public/img/cup_*.png`: 既存ディレクトリの画像ファイル(現時点でGit未追跡)をコミット対象に加える。
- 既存の`web/src/chains.test.js`等、`CHAIN_TABLE`の`shape`/`color`フィールドに依存するテストがあれば、新しいフィールド構成に合わせて更新する。

## 1. ビューア: POIラベルの配置優先度変更 (#65)

- [x] 1.1 `web/src/main.js`のカフェレイヤ(`CAFE_LAYER_ID`)のlayoutの`text-variable-anchor`を`["right", "bottom"]`から`["left", "top"]`に変更する(design.md Decision 1)。
- [x] 1.2 POI密集地で、ラベルがアイコンの左優先で表示され、衝突する場合はアイコンの上にフォールバックすることを、ローカルサーバー上のブラウザ確認で検証する。

## 2. ビューア: チェーン・汎用アイコンの画像化 (#66)

- [x] 2.1 `web/public/img/cup_*.png`(9ファイル)をGitに追加する。
- [x] 2.2 `web/src/chains.js`の`CHAIN_TABLE`の各エントリから`shape`/`color`フィールドを削除し、design.md Decision 3の対応表に従って`image`フィールド(画像ファイル名)を追加する。
- [x] 2.3 `web/src/main.js`に汎用アイコン(`GENERIC_CAFE_ICON_ID`)用の画像ファイル名(`cup_black.png`)を定義する。
- [x] 2.4 `web/src/main.js`の`createChainIcon`・canvas描画によるアイコン生成処理を削除し、`map.loadImage()`で`web/public/img/`配下の画像を読み込んで`map.addImage()`に登録する処理に置き換える(design.md Decision 2)。`map.on("load", ...)`内で全アイコン分を`Promise.all`により読み込んでから`map.addLayer(...)`を呼び出す。
- [x] 2.5 `styleimagemissing`ハンドラを、`map.loadImage()`のPromiseを待って`map.addImage()`する非同期実装に更新する(design.md Decision 2)。
- [x] 2.6 既知チェーンのPOIが割り当てられた画像アイコンで、未分類のPOIが`cup_black.png`で表示されることを、ローカルサーバー上のブラウザ確認で検証する。

## 3. ビューア: ポップアップのconfidence表示形式変更 (#67)

- [ ] 3.1 `web/src/main.js`の`buildCafePopupHtml`のconfidence表示を、百分率(`Math.round(confidence * 100)}%`)から、丸めや変換を行わない元の数値のまま表示する形式に変更する(design.md Decision 4)。
- [ ] 3.2 confidenceが元の数値のまま(丸めずに)表示されることを、ローカルサーバー上のブラウザ確認で検証する。

## 4. ビューア: 地図の初期表示位置変更 (#68)

- [ ] 4.1 `web/src/main.js`の`MapLibreMap`初期化オプションの`center`を`[139.7528, 35.6852]`(皇居)、`zoom`を`10`に変更する(design.md Decision 5)。
- [ ] 4.2 URLハッシュ無しでページを開くと皇居周辺・ズームレベル10で初期化され、ハッシュ付きURLで開いた場合はハッシュの位置が優先されることを、ローカルサーバー上のブラウザ確認で検証する。

## 5. 動作確認 (#69)

- [ ] 5.1 `cd web && npm test`で既存テストにリグレッションがないことを確認する(`CHAIN_TABLE`の`shape`/`color`削除に伴うテストへの影響がないことを含む)。
- [ ] 5.2 `web`の開発/配信手順(`web/README.md`参照)でローカル配信し、本changeの全変更(ラベル配置・チェーンアイコンの画像表示・confidence表示形式・初期表示位置)をブラウザで一通り確認する。

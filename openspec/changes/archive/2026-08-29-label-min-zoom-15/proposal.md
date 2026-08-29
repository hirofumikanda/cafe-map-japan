## Why

現状のPOIラベルはシンボルレイヤの`minzoom`(z10)から表示されるため、広域表示(z10〜14)ではラベルが密集して地図が読みづらい。ラベルはある程度拡大して個々の店舗を確認したい局面でのみ有用なので、表示開始ズームを引き上げて広域表示の視認性を改善する。

## What Changes

- カフェ・喫茶店POIシンボルのラベル(`text-field`)を、ズームレベル15以上でのみ表示する。z15未満ではアイコンのみを表示し、ラベルは表示しない。
- アイコン本体・アイコンのズーム出し分け(チェーン/非チェーン)・confidenceフィルタ・ポップアップ・ラベル配置ルール(左優先→衝突時は上)は変更しない。

## Capabilities

### New Capabilities

(なし)

### Modified Capabilities

- `cafe-map-viewer`: 「POIラベルの配置」要件に、ラベルはズームレベル15以上でのみ表示し、z15未満では表示しないという表示条件を追加する。

## Impact

- `web/src/main.js`: `CAFE_LAYER_ID`レイヤの`layout`定義(`text-field`のズーム依存化、または`text-opacity`等でのズーム制御)。
- `openspec/specs/cafe-map-viewer/spec.md`: 「POIラベルの配置」要件の同期(archive時)。
- 挙動変更のみでAPI・依存関係・タイル生成への影響はなし。

## Why

`web/src/chains.js`の`CHAIN_TABLE`にはドトールコーヒー・カフェ・ベローチェの2チェーンしか登録されておらず、それ以外の主要チェーン店(スターバックス、コメダ珈琲店等)のPOIは専用アイコンを持たず汎用カフェアイコンにフォールバックしてしまう(Issue #37)。

## What Changes

- `CHAIN_TABLE`に以下8チェーンをエントリとして追加する: スターバックス、コメダ珈琲店、タリーズコーヒー、サンマルクカフェ、エクセルシオール カフェ、上島珈琲店、銀座ルノアール、BECK'S COFFEE SHOP。各エントリは`id`/`iconId`/`label`/`matchKeys`(表記ゆれを考慮した複数キー)/`shape`/`color`を持つ。
- `web/src/chains.test.js`に、追加したチェーンの`resolveChainIconId`によるマッチングを検証するテストケースを追加する。

## Capabilities

### New Capabilities
(なし)

### Modified Capabilities
(なし)

既存spec([cafe-map-viewer](../../specs/cafe-map-viewer/spec.md))の「チェーン店のアイコンによる視覚的識別」要件は、ブランド識別情報が既知チェーン(例示であり網羅列挙ではない)に一致するPOIを専用アイコンで表示する、という汎用的な振る舞いを既に規定しており、`CHAIN_TABLE`へのエントリ追加はこの既存の振る舞いに従うデータの拡張にすぎず、spec-levelの振る舞い変更を伴わない。そのため本changeは`skip_specs: true`とし、delta specは作成しない。

## Impact

- `web/src/chains.js`(`CHAIN_TABLE`へのエントリ追加)
- `web/src/chains.test.js`(テストケース追加)
- `web/src/main.js`(`CHAIN_TABLE`から`ICON_DEFS`を自動生成しているため、既存コードの変更なしに新チェーンのアイコンが生成・登録される)

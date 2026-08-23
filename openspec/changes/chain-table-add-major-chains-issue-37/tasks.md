## 1. CHAIN_TABLEへのチェーン追加 (Issue #37)

- [x] 1.1 `web/src/chains.js`の`CHAIN_TABLE`に、スターバックス・コメダ珈琲店・タリーズコーヒー・サンマルクカフェ・エクセルシオール カフェ・上島珈琲店・銀座ルノアール・BECK'S COFFEE SHOPの8チェーンを、それぞれ`id`/`iconId`/`label`/`matchKeys`(表記ゆれを考慮した複数キー)/`shape`/`color`を定義したエントリとして追加する
- [x] 1.2 各チェーンの`shape`/`color`を、既存の2チェーン(ドトール: square/#c8102e、ベローチェ: diamond/#1b7a3d)を含む全チェーン間で視覚的に区別できるよう選定する

## 2. テストの追加 (Issue #37)

- [x] 2.1 `web/src/chains.test.js`に、追加した各チェーンについて`resolveChainIconId`が正しい`iconId`を返すことを検証するテストケースを追加する
- [x] 2.2 `npm test`(web)を実行し、既存テスト(`buildIconImageExpression`の要素数検証を含む)と追加テストが全てpassすることを確認する

## 3. 動作確認 (Issue #37)

- [x] 3.1 `npm run build`・`npm run serve`(web)でローカル起動し、`main.js`が`CHAIN_TABLE`から生成する`ICON_DEFS`に追加チェーン分のアイコン定義が含まれ、`registerCafeIcons`/`styleimagemissing`ハンドラでエラーなくアイコンが生成・登録されることをブラウザで確認する

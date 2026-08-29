## 1. ラベルのズーム出し分け実装

<!-- GitHub Issue: #85 -->

- [x] 1.1 `web/src/main.js`の`CAFE_LAYER_ID`レイヤ`layout`で、`text-field`をズーム依存の`step`式に置き換える(z15未満は空文字列、z15以上は`["coalesce", ["get","name"], ["get","brand"], ["get","operator"]]`)
- [x] 1.2 `text-field`のズーム出し分け意図を説明するコメントを追記し、`text-optional: true`によりz15未満でもアイコンが表示され続けることを明記する
- [x] 1.3 `icon-image`・`filter`(confidenceフィルタ / チェーン・非チェーンのズーム出し分け)・クリック/ホバーのイベント登録を変更していないことを確認する

## 2. 動作確認

<!-- GitHub Issue: #86 -->

- [ ] 2.1 `cd web && npm test` が通ることを確認する
- [ ] 2.2 `cd web && npm run build` が成功することを確認する
- [ ] 2.3 `npm run serve` でマップを開き、z14ではアイコンのみ・ラベル非表示、z15以上でラベルが表示されることを目視確認する
- [ ] 2.4 z15以上でラベル配置(左優先→衝突時は上)とポップアップが従来どおり動作することを目視確認する

## 3. 仕様の反映

<!-- GitHub Issue: #85 -->

- [x] 3.1 `openspec validate label-min-zoom-15 --strict` が通ることを確認する

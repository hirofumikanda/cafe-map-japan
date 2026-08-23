## MODIFIED Requirements

### Requirement: ブランド識別情報の保持
システムは取得したGeoJSONの各Featureに、チェーン店判定に利用可能なブランド識別情報(Overture Placesの`names`・`brand`・`categories`等に相当する属性)を欠落させずpropertiesとして保持しなければならない(SHALL)。

#### Scenario: チェーン店のブランドタグが保持される
- **WHEN** Overture Places上で`brand`属性を持つPOI(例: ドトール、ベローチェ)を取得する
- **THEN** 出力GeoJSONの対応するFeatureのpropertiesに当該ブランド名の値が保持される

## REMOVED Requirements

### Requirement: OverpassからのPOI取得
**Reason**: POIの取得元をOverpass API(OpenStreetMapのライブクエリ)からOverture Maps Placesデータ(confidenceスコア付きのバルクデータセット)へ変更したため、Overpass固有の取得要件は廃止する。
**Migration**: 「Overture Maps PlacesからのPOI取得」要件および「confidenceによる品質フィルタ」要件に置き換える。

## ADDED Requirements

### Requirement: Overture Maps PlacesからのPOI取得
システムはOverture Maps Foundationが公開するPlacesデータセットから、日本国内に所在するカフェ・喫茶店に該当するPOI(`categories.primary`が`cafe`または`coffee_shop`に該当するレコード)を取得しなければならない(SHALL)。取得結果はGeoJSON FeatureCollectionとして出力し、各Featureは店名・ブランド・カテゴリ等、Overture Places上の属性情報をpropertiesとして保持しなければならない(SHALL)。

#### Scenario: 日本全国のカフェPOIを取得する
- **WHEN** データ取得処理を実行する
- **THEN** 日本国内のカテゴリが`cafe`または`coffee_shop`に該当するPOIがGeoJSON FeatureCollectionとして出力される

#### Scenario: Overture Placesデータの取得に失敗する
- **WHEN** Overture Placesデータへのアクセスがタイムアウトまたはエラーで失敗する
- **THEN** 処理は失敗を明示して終了し、不完全なGeoJSONを正常出力として扱わない

### Requirement: confidenceによる品質フィルタ
システムはOverture Placesレコードの`confidence`値が0.9以上のレコードのみを取得対象とし、0.9未満のレコードは出力するGeoJSONから除外しなければならない(SHALL)。

#### Scenario: confidenceが0.9以上のPOIが含まれる
- **WHEN** `confidence`が0.9以上のカフェ・喫茶店POIを取得する
- **THEN** 当該POIは出力GeoJSONのFeatureCollectionに含まれる

#### Scenario: confidenceが0.9未満のPOIが除外される
- **WHEN** `confidence`が0.9未満のカフェ・喫茶店POIが存在する
- **THEN** 当該POIは出力GeoJSONのFeatureCollectionに含まれない

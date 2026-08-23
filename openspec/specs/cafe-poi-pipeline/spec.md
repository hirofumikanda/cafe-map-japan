# cafe-poi-pipeline Specification

## Purpose

Overpass APIから日本全国のカフェ・喫茶店POIを取得してGeoJSON化し、z10-14のMVT形式PMTilesアーカイブへ変換したうえで静的配信可能な状態にするデータパイプライン。

## Requirements

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

### Requirement: ブランド識別情報の保持
システムは取得したGeoJSONの各Featureに、チェーン店判定に利用可能なブランド識別情報(Overture Placesの`names`・`brand`・`categories`等に相当する属性)を欠落させずpropertiesとして保持しなければならない(SHALL)。

#### Scenario: チェーン店のブランドタグが保持される
- **WHEN** Overture Places上で`brand`属性を持つPOI(例: ドトール、ベローチェ)を取得する
- **THEN** 出力GeoJSONの対応するFeatureのpropertiesに当該ブランド名の値が保持される

### Requirement: GeoJSONからPMTilesへの変換
システムは取得したGeoJSONを、ズームレベルz10からz14までのMVT(Mapbox Vector Tile)を含むPMTilesアーカイブへ変換しなければならない(SHALL)。生成されたPMTilesはz10未満・z14超過のタイルデータを含まない(SHALL NOT)。変換処理は、タイルサイズ・フィーチャ数上限による間引きに加え、ズームレベルごとの密度ベースの間引き(dot-density drop)も無効化しなければならず(SHALL)、z10からz14までのいずれのズームレベルにおいてもGeoJSON中の各POIを間引いてはならない(SHALL NOT)。

#### Scenario: 指定ズーム範囲でPMTilesが生成される
- **WHEN** GeoJSONをPMTilesへ変換する
- **THEN** 生成されたPMTilesアーカイブのメタデータ上のminzoomが10、maxzoomが14として記録される

#### Scenario: 全POIがいずれかのタイルに含まれる
- **WHEN** GeoJSON中の各POIをPMTilesへ変換する
- **THEN** 各POIは変換後、z10からz14までの各ズームレベルにおいて、対応する座標のタイル内にFeatureとして存在する

### Requirement: PMTilesの静的配信
システムは生成したPMTilesファイルを、クライアントからのHTTP Rangeリクエストに対応した静的配信手段で公開しなければならない(SHALL)。

#### Scenario: HTTP Rangeリクエストに応答する
- **WHEN** クライアントがPMTilesファイルの一部バイト範囲を指定してリクエストする
- **THEN** 配信元は206 Partial Contentで該当範囲のデータを返す

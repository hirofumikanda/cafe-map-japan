## Purpose

Overpass APIから日本全国のカフェ・喫茶店POIを取得してGeoJSON化し、z10-14のMVT形式PMTilesアーカイブへ変換したうえで静的配信可能な状態にするデータパイプライン。

## ADDED Requirements

### Requirement: OverpassからのPOI取得
システムはOverpass APIに対して日本全国を対象としたクエリを発行し、カフェ・喫茶店に該当するPOI(`amenity=cafe`を含む関連タグ)を取得しなければならない(SHALL)。取得結果はGeoJSON FeatureCollectionとして出力し、各Featureは店名・チェーンブランド・住所等、OSM上のタグ情報をpropertiesとして保持しなければならない(SHALL)。

#### Scenario: 全国のカフェPOIを取得する
- **WHEN** データ取得処理を実行する
- **THEN** 日本全国のamenity=cafe(および同等の関連タグ)を持つPOIがGeoJSON FeatureCollectionとして出力される

#### Scenario: Overpass APIがエラーを返す
- **WHEN** Overpass APIがタイムアウトまたはエラーレスポンスを返す
- **THEN** 処理は失敗を明示して終了し、不完全なGeoJSONを正常出力として扱わない

### Requirement: ブランド識別情報の保持
システムは取得したGeoJSONの各Featureに、チェーン店判定に利用可能なブランド識別情報(`brand`・`operator`・`name`等のタグ)を欠落させずpropertiesとして保持しなければならない(SHALL)。

#### Scenario: チェーン店のブランドタグが保持される
- **WHEN** OSM上で`brand`または`operator`タグを持つPOI(例: ドトール、ベローチェ)を取得する
- **THEN** 出力GeoJSONの対応するFeatureのpropertiesに当該タグの値が保持される

### Requirement: GeoJSONからPMTilesへの変換
システムは取得したGeoJSONを、ズームレベルz10からz14までのMVT(Mapbox Vector Tile)を含むPMTilesアーカイブへ変換しなければならない(SHALL)。生成されたPMTilesはz10未満・z14超過のタイルデータを含まない(SHALL NOT)。

#### Scenario: 指定ズーム範囲でPMTilesが生成される
- **WHEN** GeoJSONをPMTilesへ変換する
- **THEN** 生成されたPMTilesアーカイブのメタデータ上のminzoomが10、maxzoomが14として記録される

#### Scenario: 全POIがいずれかのタイルに含まれる
- **WHEN** GeoJSON中の各POIをPMTilesへ変換する
- **THEN** 各POIは変換後、対応する座標のz14タイル内にFeatureとして存在する

### Requirement: PMTilesの静的配信
システムは生成したPMTilesファイルを、クライアントからのHTTP Rangeリクエストに対応した静的配信手段で公開しなければならない(SHALL)。

#### Scenario: HTTP Rangeリクエストに応答する
- **WHEN** クライアントがPMTilesファイルの一部バイト範囲を指定してリクエストする
- **THEN** 配信元は206 Partial Contentで該当範囲のデータを返す

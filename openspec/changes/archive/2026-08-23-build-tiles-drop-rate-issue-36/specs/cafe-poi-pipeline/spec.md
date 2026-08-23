## MODIFIED Requirements

### Requirement: GeoJSONからPMTilesへの変換
システムは取得したGeoJSONを、ズームレベルz10からz14までのMVT(Mapbox Vector Tile)を含むPMTilesアーカイブへ変換しなければならない(SHALL)。生成されたPMTilesはz10未満・z14超過のタイルデータを含まない(SHALL NOT)。変換処理は、タイルサイズ・フィーチャ数上限による間引きに加え、ズームレベルごとの密度ベースの間引き(dot-density drop)も無効化しなければならず(SHALL)、z10からz14までのいずれのズームレベルにおいてもGeoJSON中の各POIを間引いてはならない(SHALL NOT)。

#### Scenario: 指定ズーム範囲でPMTilesが生成される
- **WHEN** GeoJSONをPMTilesへ変換する
- **THEN** 生成されたPMTilesアーカイブのメタデータ上のminzoomが10、maxzoomが14として記録される

#### Scenario: 全POIがいずれかのタイルに含まれる
- **WHEN** GeoJSON中の各POIをPMTilesへ変換する
- **THEN** 各POIは変換後、z10からz14までの各ズームレベルにおいて、対応する座標のタイル内にFeatureとして存在する

## ADDED Requirements

### Requirement: confidence・websitesプロパティの保持
システムはGeoJSONの各Featureのpropertiesに、Overture Placesレコードが保持する`confidence`(信頼度スコア)を数値として保持しなければならない(SHALL)。またOverture Placesレコードが`websites`属性を持つ場合、その値をpropertiesの`websites`として保持しなければならない(SHALL)。`websites`属性を持たないレコードでは、当該propertyを省略してよい(MAY)。

#### Scenario: confidenceがpropertiesに保持される
- **WHEN** Overture PlacesレコードをGeoJSON Featureへ変換する
- **THEN** 変換後のpropertiesに、元レコードのconfidence値が数値として保持される

#### Scenario: websitesがpropertiesに保持される
- **WHEN** `websites`属性を持つOverture PlacesレコードをGeoJSON Featureへ変換する
- **THEN** 変換後のpropertiesに当該レコードのwebsites情報がwebsitesとして保持される

#### Scenario: websitesを持たないレコードではpropertyが省略される
- **WHEN** `websites`属性を持たないOverture PlacesレコードをGeoJSON Featureへ変換する
- **THEN** 変換後のpropertiesにwebsitesキーは含まれない

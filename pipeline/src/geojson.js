function getCoordinates(record) {
  const geometry = record.geometry;
  if (
    geometry?.type === "Point" &&
    Array.isArray(geometry.coordinates) &&
    typeof geometry.coordinates[0] === "number" &&
    typeof geometry.coordinates[1] === "number"
  ) {
    return [geometry.coordinates[0], geometry.coordinates[1]];
  }
  return null;
}

// Overture Placesレコードのproperties.brand相当を、既存のweb/src/chains.jsが参照する
// `brand`属性名で保持する(design.md Decision 4)。
function getBrandName(record) {
  return record.brand?.names?.primary;
}

// OvertureにはOSMの`addr:*`タグのような構造化された住所要素が無いため、
// 整形済みの1行住所(`addresses[0].freeform`)をそのまま`address`として保持する
// (design.md Decision 4)。
function getAddress(record) {
  return record.addresses?.[0]?.freeform;
}

// Overture Placesレコード(overture-client.jsの`queryOverturePlaces`が返す形)を
// GeoJSON Point Featureへ変換する。既存のPMTiles変換・チェーン判定(web/src/chains.js)が
// そのまま利用できるよう、`name`・`brand`をOSMタグ互換のproperties名で保持する
// (design.md Decision 4)。Overture Placesには`operator`に相当する属性が無いため設定しない。
export function elementsToFeatures(records) {
  const features = [];

  for (const record of records) {
    const coordinates = getCoordinates(record);
    if (!coordinates) {
      continue;
    }

    const properties = {};

    const name = record.names?.primary;
    if (name) {
      properties.name = name;
    }

    const brand = getBrandName(record);
    if (brand) {
      properties.brand = brand;
    }

    const address = getAddress(record);
    if (address) {
      properties.address = address;
    }

    features.push({
      type: "Feature",
      id: record.id,
      geometry: { type: "Point", coordinates },
      properties,
    });
  }

  return features;
}

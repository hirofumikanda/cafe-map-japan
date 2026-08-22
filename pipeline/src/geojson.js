function getCoordinates(element) {
  if (typeof element.lon === "number" && typeof element.lat === "number") {
    return [element.lon, element.lat];
  }
  if (
    element.center &&
    typeof element.center.lon === "number" &&
    typeof element.center.lat === "number"
  ) {
    return [element.center.lon, element.center.lat];
  }
  return null;
}

// Overpass APIのelements(node/way/relation)をGeoJSON Point Featureへ変換する。
// name/brand/operator等、OSM上のタグはproperties側で欠落させず保持する(spec: ブランド識別情報の保持)。
export function elementsToFeatures(elements) {
  const features = [];

  for (const element of elements) {
    const coordinates = getCoordinates(element);
    if (!coordinates) {
      continue;
    }

    features.push({
      type: "Feature",
      id: `${element.type}/${element.id}`,
      geometry: { type: "Point", coordinates },
      properties: { ...element.tags },
    });
  }

  return features;
}

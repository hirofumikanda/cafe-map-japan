import { Map as MapLibreMap } from "maplibre-gl";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// design.md 決定4: 背景地図はOSM Standardのラスタータイルをそのまま利用し、
// OSM利用規約に従った帰属表示(attribution)を地図上に表示する。
const style = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

new MapLibreMap({
  container: "map",
  style,
  center: [138.0, 37.0],
  zoom: 5,
});

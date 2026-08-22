import { Map as MapLibreMap, addProtocol } from "maplibre-gl";
import { Protocol as PMTilesProtocol } from "pmtiles";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// design.md 決定3: pmtilesライブラリのProtocolをmaplibregl.addProtocolに登録し、
// vector sourceを`pmtiles://<配信URL>/cafe.pmtiles`として参照する。
const pmtilesProtocol = new PMTilesProtocol();
addProtocol("pmtiles", pmtilesProtocol.tile);

// cafe.pmtilesはこのページと同じ場所(オリジン+ベースパス)から配信される想定。
// GitHub Pagesのプロジェクトサイト(https://<user>.github.io/<repo>/)でも
// 相対パス解決により正しいURLになる(design.md GitHub Pages留意点)。
const CAFE_PMTILES_URL = new URL("cafe.pmtiles", window.location.href).href;

const CAFE_SOURCE_ID = "cafe";
const CAFE_LAYER_ID = "cafe";
const CAFE_SOURCE_LAYER = "cafe";
const CAFE_GENERIC_ICON_ID = "cafe-generic";
// PMTilesの生成ズーム範囲(z10-14)のうち、シンボルレイヤを表示し始める下限。
// z14を超えるズームでは意図的にlayer側のmaxzoomを設定せず、ソースのオーバーズームで表示させ続ける。
const CAFE_LAYER_MIN_ZOOM = 10;

const style = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: OSM_ATTRIBUTION,
    },
    [CAFE_SOURCE_ID]: {
      type: "vector",
      url: `pmtiles://${CAFE_PMTILES_URL}`,
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

const map = new MapLibreMap({
  container: "map",
  style,
  center: [138.0, 37.0],
  zoom: 5,
});

// ブラウザのdevtoolsから地図の状態を確認できるよう公開しておく(動作確認・デバッグ用)。
window.cafeMap = map;

// チェーン店専用アイコン・汎用アイコンのスプライト(Issue #8)が用意されるまでの
// 汎用プレースホルダアイコンを、canvasで生成してその場で登録する。
function createGenericCafeIcon(size = 32) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#6f4e37";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  return ctx.getImageData(0, 0, size, size);
}

// スタイル読み込み完了を待たずにレイヤへ`icon-image`参照を追加すると、初回描画時に
// アイコン未登録のままレンダリングされてしまう(styleimagemissingの解決が非同期のため)。
// そのためレイヤ追加より前に、この時点で同期的にアイコンを登録しておく。
map.on("styleimagemissing", (e) => {
  if (e.id === CAFE_GENERIC_ICON_ID && !map.hasImage(CAFE_GENERIC_ICON_ID)) {
    map.addImage(CAFE_GENERIC_ICON_ID, createGenericCafeIcon());
  }
});

map.on("load", () => {
  if (!map.hasImage(CAFE_GENERIC_ICON_ID)) {
    map.addImage(CAFE_GENERIC_ICON_ID, createGenericCafeIcon());
  }

  // spec: PMTilesの生成ズーム範囲(z10-14)を外れるズームレベルでは、
  // オーバーズームまたは非表示によって適切に扱わなければならない(SHALL)。
  // layerに`minzoom`のみを設定し、z10未満では非表示にする。`maxzoom`は設定しないため、
  // z14超では(ソース側がpmtilesヘッダから自動取得したmaxzoom=14の)z14タイルの
  // オーバーズームによって表示され続ける。
  map.addLayer({
    id: CAFE_LAYER_ID,
    type: "symbol",
    source: CAFE_SOURCE_ID,
    "source-layer": CAFE_SOURCE_LAYER,
    minzoom: CAFE_LAYER_MIN_ZOOM,
    layout: {
      "icon-image": CAFE_GENERIC_ICON_ID,
      "icon-allow-overlap": true,
      "icon-size": 0.6,
    },
  });
});

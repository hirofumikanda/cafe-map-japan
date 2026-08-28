import { Map as MapLibreMap, NavigationControl, Popup, addProtocol } from "maplibre-gl";
import { Protocol as PMTilesProtocol } from "pmtiles";

import { CHAIN_TABLE, GENERIC_CAFE_ICON_ID, buildIconImageExpression } from "./chains.js";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

// design.md Decision 9: カフェPOIデータの出典であるOverture Maps Foundationへの帰属表示。
const OVERTURE_ATTRIBUTION =
  '&copy; <a href="https://overturemaps.org/" target="_blank" rel="noopener">Overture Maps Foundation</a>';

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
// PMTilesの生成ズーム範囲(z10-14)のうち、シンボルレイヤを表示し始める下限。
// z14を超えるズームでは意図的にlayer側のmaxzoomを設定せず、ソースのオーバーズームで表示させ続ける。
const CAFE_LAYER_MIN_ZOOM = 10;

// spec: ズームレベルに応じたconfidenceしきい値以上のPOIのみを表示する
// (z10-14: 0.99以上、z15: 0.97以上、z16: 0.95以上、z17以上: 0.90以上)。
// `step`式でズームごとのしきい値を宣言的に切り替え、`confidence`プロパティと比較する
// (design.md Decision 3)。ズーム変化時のJS側再評価(setFilter呼び直し)は不要。
const CAFE_CONFIDENCE_FILTER = [
  ">=",
  ["get", "confidence"],
  ["step", ["zoom"], 0.99, 15, 0.97, 16, 0.95, 17, 0.9],
];

const style = {
  version: 8,
  // design.md 決定7: POIラベルのグリフをdemotiles.maplibre.orgのフォントサーバーから取得する。
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
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
      attribution: OVERTURE_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      // design.md 決定6: 背景地図を半透明(不透明度50%)にし、POIシンボル・ラベルを見やすくする。
      paint: { "raster-opacity": 0.5 },
    },
  ],
};

const map = new MapLibreMap({
  container: "map",
  style,
  center: [138.0, 37.0],
  zoom: 5,
  // design.md 決定5: 地図の中心座標・ズーム・回転・傾きをURLハッシュへ同期する。
  // ハッシュ付きURLで開いた場合はその状態から初期化され、`center`/`zoom`は
  // ハッシュが無い場合の初期表示用フォールバックとして使われる。
  hash: true,
});

// ブラウザのdevtoolsから地図の状態を確認できるよう公開しておく(動作確認・デバッグ用)。
window.cafeMap = map;

// design.md 決定4: MapLibre標準のNavigationControl(ズーム・回転・傾き操作)を地図右上に表示する。
map.addControl(new NavigationControl(), "top-right");

// チェーン専用アイコン・汎用アイコンは、`web/public/img/`配下の色分けカップ画像
// (`cup_*.png`)を`map.loadImage()`で読み込み`map.addImage()`で登録する(design.md Decision 2)。
// 未分類POIに割り当てる汎用アイコンの画像ファイル名。
const GENERIC_CAFE_ICON_IMAGE = "cup_black.png";

// アイコンID -> 画像ファイル名(`web/public/img/`配下)の対応表。
const ICON_IMAGE_DEFS = [
  { id: GENERIC_CAFE_ICON_ID, image: GENERIC_CAFE_ICON_IMAGE },
  ...CHAIN_TABLE.map((chain) => ({ id: chain.iconId, image: chain.image })),
];

// 画像は`public/`がWebルートとして配信されるため`img/<file>`で解決できる。
// `window.location.href`基準で解決し、GitHub Pagesのサブパス配信にも対応する。
function iconImageUrl(file) {
  return new URL(`img/${file}`, window.location.href).href;
}

// 指定アイコンが未登録なら、`map.loadImage()`で画像を取得して`map.addImage()`で登録する。
async function loadAndAddCafeIcon({ id, image }) {
  if (map.hasImage(id)) {
    return;
  }
  const { data } = await map.loadImage(iconImageUrl(image));
  if (!map.hasImage(id)) {
    map.addImage(id, data);
  }
}

// スタイル再読み込み等でアイコンが未登録のまま参照された場合のフォールバック。
// `map.loadImage()`のPromiseを待って`map.addImage()`する(design.md Decision 2)。
// MapLibreは`styleimagemissing`ハンドラが後から`addImage`しても該当シンボルを再描画する。
map.on("styleimagemissing", (e) => {
  const icon = ICON_IMAGE_DEFS.find((def) => def.id === e.id);
  if (!icon) {
    return;
  }
  loadAndAddCafeIcon(icon).catch((err) => {
    console.error(`アイコン画像の読み込みに失敗しました: ${icon.image}`, err);
  });
});

map.on("load", async () => {
  // アイコンの読み込みが非同期になったため、レイヤ追加より前に全アイコン分を
  // `Promise.all`で並行ロード・登録し、初回描画時のシンボル欠落を防ぐ(design.md Decision 2)。
  await Promise.all(ICON_IMAGE_DEFS.map((icon) => loadAndAddCafeIcon(icon)));

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
    filter: CAFE_CONFIDENCE_FILTER,
    layout: {
      // spec: brand/operator/nameに基づき既知チェーンには専用アイコン、
      // それ以外には汎用アイコンを割り当てる(design.md 決定5、chains.js参照)。
      "icon-image": buildIconImageExpression(),
      "icon-allow-overlap": true,
      // ラベル追加に合わせてアイコンとラベルの合計占有面積を抑えるため縮小する(design.md 決定7)。
      "icon-size": 0.5,
      // spec: POIシンボルに店名等のラベルを表示する。ポップアップの名称フォールバック順
      // (name→brand→operator)と揃える。アイコンの左への配置を優先し、他ラベルと衝突する
      // 場合はアイコンの上にフォールバックする(design.md Decision 1)。
      "text-field": ["coalesce", ["get", "name"], ["get", "brand"], ["get", "operator"]],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "text-variable-anchor": ["left", "top"],
      "text-radial-offset": 0.6,
      // text-optionalの既定値はfalseで、その場合ラベルが衝突等で配置できないと
      // icon-allow-overlap: trueを設定していてもアイコンごとシンボル全体が非表示になる。
      // trueにすることで、ラベルが配置できない場合はラベルのみ省略しアイコンは表示され続ける
      // (design.md 決定7、Issue #60の回帰修正)。
      "text-optional": true,
    },
  });

  // spec: POIシンボルをクリックした際、店名・ブランド・住所等のプロパティをポップアップで表示する(SHALL)。
  // "click"をCAFE_LAYER_IDに紐づけて登録することで、当該レイヤのFeature上でのクリックのみに反応する
  // (POIが存在しない地点のクリックではe.featuresが空になりポップアップは表示されない)。
  map.on("click", CAFE_LAYER_ID, (e) => {
    const feature = e.features?.[0];
    if (!feature) {
      return;
    }
    new Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(e.lngLat)
      .setHTML(buildCafePopupHtml(feature.properties))
      .addTo(map);
  });

  map.on("mouseenter", CAFE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", CAFE_LAYER_ID, () => {
    map.getCanvas().style.cursor = "";
  });
});

// Overture Placesの`address`プロパティ(addresses[0].freeform相当、design.md Decision 4)は
// OSMの`addr:*`タグのような構造化要素を持たない整形済みの1行住所のため、そのまま利用する。
function buildCafeAddress(properties) {
  return properties.address || null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// タイル上ではMVTがスカラー値しか持てないため、websitesは配列そのままではなくtippecanoeが
// JSON文字列化した状態で届く(design.md Decision 1)。パースに失敗した場合・配列でない場合は
// nullを返し、呼び出し側でwebsites行自体を省略するfail-safeとする(design.md Decision 8)。
function parseWebsites(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// http/https以外のスキーム(javascript:等)をリンク化しないためのフィルタ(XSS対策、design.md Decision 8)。
function buildCafeWebsiteLinks(properties) {
  const websites = parseWebsites(properties.websites);
  if (!websites) {
    return [];
  }
  return websites.filter((url) => typeof url === "string" && /^https?:\/\//i.test(url));
}

// propertiesはOSMのタグ(利用者が編集可能な自由入力)に由来するため、HTMLへの埋め込み時は必ずエスケープする。
function buildCafePopupHtml(properties) {
  const name = properties.name || properties.brand || properties.operator || "名称不明のカフェ・喫茶店";
  const brand = properties.brand;
  const address = buildCafeAddress(properties);
  const confidence = properties.confidence;
  const websiteLinks = buildCafeWebsiteLinks(properties);

  const rows = [];
  if (brand && brand !== name) {
    rows.push(`<div class="cafe-popup-brand">${escapeHtml(brand)}</div>`);
  }
  if (address) {
    rows.push(`<div class="cafe-popup-address">${escapeHtml(address)}</div>`);
  }
  if (typeof confidence === "number") {
    rows.push(`<div class="cafe-popup-confidence">信頼度: ${Math.round(confidence * 100)}%</div>`);
  }
  if (websiteLinks.length > 0) {
    const links = websiteLinks
      .map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`)
      .join("");
    rows.push(`<div class="cafe-popup-websites">${links}</div>`);
  }

  return `<div class="cafe-popup"><div class="cafe-popup-name">${escapeHtml(name)}</div>${rows.join("")}</div>`;
}

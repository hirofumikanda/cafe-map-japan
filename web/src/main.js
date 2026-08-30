import {
  GeolocateControl,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  addProtocol,
} from "maplibre-gl";
import { Protocol as PMTilesProtocol } from "pmtiles";

import {
  CHAIN_FILTER_OPTIONS,
  CHAIN_TABLE,
  GENERIC_CAFE_ICON_ID,
  buildChainIdExpression,
  buildIconImageExpression,
} from "./chains.js";

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

// design.md Decision 1: brand/operator/nameが既知チェーンに一致すればそのidを、
// 一致しなければ空文字列を返すスタイル式。フィルタ内で「チェーン店か否か」
// (`["!=", expr, ""]`)・「特定チェーンか」(`["==", expr, "<id>"]`)の判定に使う。
const CAFE_CHAIN_ID_EXPRESSION = buildChainIdExpression();

// design.md Decision 2: カフェレイヤの`filter`を、常時適用するconfidenceフィルタと
// プルダウン選択に応じたスコープ条件の`["all", ...]`合成で組み立てる。
// - "all": チェーン店はレイヤの`minzoom`(z10)から、チェーン店以外はz14以上でのみ表示
// - 特定チェーン: 当該チェーンに一致するPOIのみ(ズーム出し分けなし。z10以上はレイヤ`minzoom`由来)
// 選択変更時はapplyChainFilter()が`map.setFilter()`でこの式を張り替えるだけでよい
// (レイヤ・ソース・アイコンは不変)。
function buildCafeFilter(selectedValue) {
  const scope =
    selectedValue === "all"
      ? ["any", ["!=", CAFE_CHAIN_ID_EXPRESSION, ""], [">=", ["zoom"], 14]]
      : ["==", CAFE_CHAIN_ID_EXPRESSION, selectedValue];
  return ["all", CAFE_CONFIDENCE_FILTER, scope];
}

// プルダウンの選択値を受け取り、カフェレイヤの`filter`だけを張り替える(design.md Decision 2)。
// チェーン絞り込みコントロール(Issue #78)の`change`イベントから呼ばれる。
function applyChainFilter(value) {
  map.setFilter(CAFE_LAYER_ID, buildCafeFilter(value));
}

// design.md Decision 3 / 4: 表示するチェーンを絞り込むプルダウンをMapLibreの`IControl`として
// `top-left`に追加する。ネイティブ`<select>`をベースに、閉じた状態の見た目のみを
// `index.html`の`<style>`(`.chain-filter-ctrl`)でカスタムする。開いた状態(選択肢リスト)は
// OSネイティブのピッカーに委ね、タッチ操作・キーボード操作・スクリーンリーダー対応を標準で得る。
const CHAIN_FILTER_LABEL_ID = "chain-filter-select-label";
const CHAIN_FILTER_SELECT_ID = "chain-filter-select";

class ChainFilterControl {
  constructor(onChange) {
    this._onChange = onChange;
  }

  onAdd() {
    const container = document.createElement("div");
    container.className = "maplibregl-ctrl chain-filter-ctrl";

    // スクリーンリーダー用のラベル。`.visually-hidden`で視覚的には隠し、`for`で`<select>`に紐付ける。
    const label = document.createElement("label");
    label.className = "visually-hidden";
    label.id = CHAIN_FILTER_LABEL_ID;
    label.setAttribute("for", CHAIN_FILTER_SELECT_ID);
    label.textContent = "表示するチェーン店を絞り込む";

    const select = document.createElement("select");
    select.id = CHAIN_FILTER_SELECT_ID;
    for (const option of CHAIN_FILTER_OPTIONS) {
      const optionEl = document.createElement("option");
      optionEl.value = option.value;
      optionEl.textContent = option.label;
      select.append(optionEl);
    }
    // design.md Non-Goals: 選択状態は永続化しないため、初期選択は常に「すべて」。
    select.value = "all";
    select.addEventListener("change", () => {
      this._onChange(select.value);
    });

    // design.md Decision 3: コントローラDOM上のポインタ/ホイール系イベントの伝播を止め、
    // 地図のドラッグ・ダブルクリックズーム・ホイールズーム・タッチジェスチャと干渉させない。
    for (const type of ["mousedown", "dblclick", "wheel", "touchstart"]) {
      container.addEventListener(type, (event) => {
        event.stopPropagation();
      });
    }

    container.append(label, select);
    this._container = container;
    return container;
  }

  onRemove() {
    this._container?.remove();
    this._container = undefined;
  }
}


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
  // design.md Decision 5: ハッシュ無し時の初期表示は皇居(東京都千代田区)周辺・ズームレベル10。
  center: [139.7528, 35.6852],
  zoom: 10,
  // design.md 決定5: 地図の中心座標・ズーム・回転・傾きをURLハッシュへ同期する。
  // ハッシュ付きURLで開いた場合はその状態から初期化され、`center`/`zoom`は
  // ハッシュが無い場合の初期表示用フォールバックとして使われる。
  hash: true,
});

// ブラウザのdevtoolsから地図の状態を確認できるよう公開しておく(動作確認・デバッグ用)。
window.cafeMap = map;
// チェーン絞り込みコントロールと同じ適用処理を、devtoolsからも呼べるよう公開する。
window.applyChainFilter = applyChainFilter;

// design.md 決定4: MapLibre標準のNavigationControl(ズーム・回転・傾き操作)を地図右上に表示する。
map.addControl(new NavigationControl(), "top-right");

// design.md Decision: 現在地表示コントロール。`trackUserLocation: true`で初回押下時に
// 現在地へ`flyTo`し追従モードに入り、再押下で解除する標準UIを使う。`showUserLocation`
// (既定true)で現在地マーカーと精度円を描画し、`enableHighAccuracy: true`でモバイルの
// 現在地精度を優先する。Geolocation APIはセキュアコンテキスト(https/localhost)でのみ動作する。
const geolocateControl = new GeolocateControl({
  positionOptions: { enableHighAccuracy: true },
  trackUserLocation: true,
  showUserLocation: true,
});
// design.md Decision: エラー処理はMapLibre標準に委ね、独自エラーUIは追加しない。
// 権限拒否・取得失敗時はGeolocateControlが自動でボタンを非アクティブ表示に戻すため、
// ここではデバッグ用にwarnするに留める(地図・他コントロール・POI表示は影響を受けない)。
geolocateControl.on("error", (e) => {
  console.warn("現在地の取得に失敗しました", e);
});

// design.md Decision: 自動追加される帰属表示(`AttributionControl`)はそのままに、
// Geolocateコントロールを`bottom-right`へ追加する。MapLibreは下辺コーナーへの追加時に
// コンテナ先頭へ挿入する(`insertBefore(firstChild)`)ため、後から追加したGeolocateボタンが
// 先に入っている帰属表示ボタンの上に配置される。帰属表示の内容(MapLibre / OSM /
// Overture Maps Foundation)は自動追加のまま変更しない。
map.addControl(geolocateControl, "bottom-right");

// design.md Decision 3: チェーン絞り込みプルダウンを地図左上に追加する。
// `change`で`applyChainFilter()`を呼び、カフェレイヤの`filter`だけを張り替える。
map.addControl(new ChainFilterControl(applyChainFilter), "top-left");

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
    // design.md Decision 2: 初期状態はプルダウン「すべて」。confidenceフィルタと
    // チェーン/非チェーンのズーム出し分けを合成した式を設定する。
    filter: buildCafeFilter("all"),
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
      // spec: ラベルはズームレベル15以上でのみ表示し、z15未満では表示しない
      // (label-min-zoom-15 design.md Decision)。MapLibreのシンボルレイアウトには
      // ラベル単体の最小ズーム指定がないため、`step`式でz15未満は空文字列を返して
      // ラベルを生成しない。`text-optional: true`により、ラベルが無いズームでも
      // アイコンは通常どおり表示され続ける。
      "text-field": [
        "step",
        ["zoom"],
        "",
        15,
        ["coalesce", ["get", "name"], ["get", "brand"], ["get", "operator"]],
      ],
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
    // spec: confidenceは丸め・変換を行わず、元の数値をそのまま表示する(design.md Decision 4)。
    rows.push(`<div class="cafe-popup-confidence">信頼度: ${confidence}</div>`);
  }
  if (websiteLinks.length > 0) {
    const links = websiteLinks
      .map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`)
      .join("");
    rows.push(`<div class="cafe-popup-websites">${links}</div>`);
  }

  return `<div class="cafe-popup"><div class="cafe-popup-name">${escapeHtml(name)}</div>${rows.join("")}</div>`;
}

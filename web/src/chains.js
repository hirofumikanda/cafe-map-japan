// design.md 決定5: POIの`brand`タグ(なければ`operator`/`name`)を既知チェーン名の
// 照合テーブルと突き合わせ、一致すれば専用アイコン、しなければ汎用アイコンに
// フォールバックする。新しいチェーンを追加する場合はこの配列にエントリを1件足すだけでよい。
//
// `matchKeys`は部分一致で判定するため、法人格表記(株式会社等)や店舗形態違い
// (例:「ドトールコーヒーショップ」)は個別に列挙しなくても自動的に一致する。
export const GENERIC_CAFE_ICON_ID = "cafe-generic";

export const CHAIN_TABLE = [
  {
    id: "doutor",
    iconId: "chain-doutor",
    label: "ドトールコーヒー",
    matchKeys: ["ドトールコーヒー", "ドトール"],
    image: "cup_yellow.png",
  },
  {
    id: "veloce",
    iconId: "chain-veloce",
    label: "カフェ・ベローチェ",
    matchKeys: ["カフェ・ベローチェ", "ベローチェ"],
    image: "cup_red.png",
  },
  {
    id: "starbucks",
    iconId: "chain-starbucks",
    label: "スターバックス コーヒー",
    matchKeys: ["スターバックスコーヒー", "スターバックス", "スタバ"],
    image: "cup_green.png",
  },
  {
    id: "komeda",
    iconId: "chain-komeda",
    label: "コメダ珈琲店",
    matchKeys: ["コメダ珈琲店", "コメダ"],
    image: "cup_orange.png",
  },
  {
    id: "tullys",
    iconId: "chain-tullys",
    label: "タリーズコーヒー",
    matchKeys: ["タリーズコーヒー", "タリーズ"],
    image: "cup_gold.png",
  },
  {
    id: "sanmarc",
    iconId: "chain-sanmarc",
    label: "サンマルクカフェ",
    matchKeys: ["サンマルクカフェ", "サンマルク"],
    image: "cup_darkred.png",
  },
  {
    id: "excelsior",
    iconId: "chain-excelsior",
    label: "エクセルシオール カフェ",
    matchKeys: ["エクセルシオールカフェ", "エクセルシオール"],
    image: "cup_blue.png",
  },
  {
    id: "ueshima",
    iconId: "chain-ueshima",
    label: "上島珈琲店",
    matchKeys: ["上島珈琲店", "上島"],
    image: "cup_brown.png",
  },
  {
    id: "renoir",
    iconId: "chain-renoir",
    label: "銀座ルノアール",
    matchKeys: ["銀座ルノアール", "喫茶室ルノアール", "ルノアール"],
    image: "cup_darkbrown.png",
  },
  {
    id: "becks",
    iconId: "chain-becks",
    label: "BECK'S COFFEE SHOP",
    matchKeys: ["BECK'S COFFEE SHOP", "BECK'S", "ベックスコーヒーショップ", "ベックス"],
    image: "cup_pink.png",
  },
];

// ブランド名表記ゆれ(全角/半角、法人格の有無、前後の空白等)を吸収する正規化。
// NFKCで半角カタカナ・全角英数字等の互換文字を統一し、代表的な法人格表記を除去する。
export function normalizeChainText(value) {
  if (!value) {
    return "";
  }
  return value
    .normalize("NFKC")
    .replace(/株式会社|有限会社|合同会社|\(株\)|（株）/g, "")
    .replace(/\s+/g, "")
    .trim();
}

// brand(優先)・operator・nameの順にproperties内を探索し、既知チェーンの
// matchKeysのいずれかを部分一致で含んでいれば、そのチェーンのiconIdを返す。
// 一致しなければ汎用カフェアイコンのIDを返す(安全側のフォールバック)。
export function resolveChainIconId(properties, table = CHAIN_TABLE) {
  const candidates = [properties?.brand, properties?.operator, properties?.name]
    .filter(Boolean)
    .map(normalizeChainText);

  for (const chain of table) {
    const keys = chain.matchKeys.map(normalizeChainText);
    if (candidates.some((text) => keys.some((key) => key.length > 0 && text.includes(key)))) {
      return chain.iconId;
    }
  }
  return GENERIC_CAFE_ICON_ID;
}

// brand/operator/nameを結合した「検索対象文字列」を表すスタイル式。
// buildIconImageExpression()・buildChainIdExpression()で共有する。
const CHAIN_SEARCH_TEXT_EXPRESSION = [
  "concat",
  ["coalesce", ["get", "brand"], ""],
  ["coalesce", ["get", "operator"], ""],
  ["coalesce", ["get", "name"], ""],
];

// 1チェーン分のmatchKeys部分一致条件(`in`式)を組み立てる。複数キーは
// `["any", ...]`でまとめる。アイコン式・チェーンID式で共有し、二重メンテを防ぐ。
function chainMatchCondition(chain) {
  const conditions = chain.matchKeys.map((key) => ["in", key, CHAIN_SEARCH_TEXT_EXPRESSION]);
  return conditions.length === 1 ? conditions[0] : ["any", ...conditions];
}

// 制約(buildIconImageExpression / buildChainIdExpression 共通):
// MapLibreのスタイル式にはNFKC正規化に相当する演算がないため、
// resolveChainIconId()と異なりタイル上の生プロパティ文字列に対してそのまま
// 部分一致判定を行う。実データのbrandタグは表記が安定していること、
// 部分一致自体が法人格表記等の揺れを吸収できること、未一致時は安全側に
// フォールバックすることから、実用上十分な精度を確保している。

// MapLibreの`case`式で、検索対象文字列に対してチェーンごとのmatchKeysを部分一致で
// 判定し、一致したチェーンのicon-imageを返す宣言的なスタイル式を組み立てる。
// いずれにも一致しなければ汎用アイコンを返す。
export function buildIconImageExpression(table = CHAIN_TABLE) {
  const expression = ["case"];
  for (const chain of table) {
    expression.push(chainMatchCondition(chain), chain.iconId);
  }
  expression.push(GENERIC_CAFE_ICON_ID);

  return expression;
}

// buildIconImageExpression()と同じmatchKeys部分一致ロジックで、一致したチェーンの
// `id`(例: `"starbucks"`)を返す`case`式。どのチェーンにも一致しなければ空文字列を返す。
// レイヤのfilter式で「チェーン店か」(`["!=", expr, ""]`)や特定チェーン絞り込み
// (`["==", expr, "<id>"]`)の判定に使う。評価順は buildIconImageExpression() と同一
// (`CHAIN_TABLE`順)。
export function buildChainIdExpression(table = CHAIN_TABLE) {
  const expression = ["case"];
  for (const chain of table) {
    expression.push(chainMatchCondition(chain), chain.id);
  }
  expression.push("");

  return expression;
}

// チェーン絞り込みプルダウンの選択肢。先頭は「すべて」、以降は`CHAIN_TABLE`順に
// `{ value: id, label }`を導出する。チェーン追加時は`CHAIN_TABLE`へ1件足すだけで
// プルダウンにも反映される。
export const CHAIN_FILTER_OPTIONS = [
  { value: "all", label: "すべて" },
  ...CHAIN_TABLE.map((chain) => ({ value: chain.id, label: chain.label })),
];

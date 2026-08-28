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
    image: "cup_red.png",
  },
  {
    id: "veloce",
    iconId: "chain-veloce",
    label: "カフェ・ベローチェ",
    matchKeys: ["カフェ・ベローチェ", "ベローチェ"],
    image: "cup_green.png",
  },
  {
    id: "starbucks",
    iconId: "chain-starbucks",
    label: "スターバックス コーヒー",
    matchKeys: ["スターバックスコーヒー", "スターバックス", "スタバ"],
    image: "cup_water.png",
  },
  {
    id: "komeda",
    iconId: "chain-komeda",
    label: "コメダ珈琲店",
    matchKeys: ["コメダ珈琲店", "コメダ"],
    image: "cup_brown.png",
  },
  {
    id: "tullys",
    iconId: "chain-tullys",
    label: "タリーズコーヒー",
    matchKeys: ["タリーズコーヒー", "タリーズ"],
    image: "cup_green.png",
  },
  {
    id: "sanmarc",
    iconId: "chain-sanmarc",
    label: "サンマルクカフェ",
    matchKeys: ["サンマルクカフェ", "サンマルク"],
    image: "cup_yellow.png",
  },
  {
    id: "excelsior",
    iconId: "chain-excelsior",
    label: "エクセルシオール カフェ",
    matchKeys: ["エクセルシオールカフェ", "エクセルシオール"],
    image: "cup_pink.png",
  },
  {
    id: "ueshima",
    iconId: "chain-ueshima",
    label: "上島珈琲店",
    matchKeys: ["上島珈琲店", "上島"],
    image: "cup_orange.png",
  },
  {
    id: "renoir",
    iconId: "chain-renoir",
    label: "銀座ルノアール",
    matchKeys: ["銀座ルノアール", "喫茶室ルノアール", "ルノアール"],
    image: "cup_blue.png",
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

// MapLibreの`case`式で、brand/operator/nameを結合した文字列に対してチェーンごとの
// matchKeysを部分一致(`in`式)で判定し、一致したチェーンのicon-imageを返す
// 宣言的なスタイル式を組み立てる。いずれにも一致しなければ汎用アイコンを返す。
//
// 制約: MapLibreのスタイル式にはNFKC正規化に相当する演算がないため、
// resolveChainIconId()と異なりタイル上の生プロパティ文字列に対してそのまま
// 部分一致判定を行う。実データのbrandタグは表記が安定していること、
// 部分一致自体が法人格表記等の揺れを吸収できること、未一致時は安全側の
// 汎用アイコンにフォールバックすることから、実用上十分な精度を確保している。
export function buildIconImageExpression(table = CHAIN_TABLE) {
  const searchText = [
    "concat",
    ["coalesce", ["get", "brand"], ""],
    ["coalesce", ["get", "operator"], ""],
    ["coalesce", ["get", "name"], ""],
  ];

  const expression = ["case"];
  for (const chain of table) {
    const conditions = chain.matchKeys.map((key) => ["in", key, searchText]);
    const condition = conditions.length === 1 ? conditions[0] : ["any", ...conditions];
    expression.push(condition, chain.iconId);
  }
  expression.push(GENERIC_CAFE_ICON_ID);

  return expression;
}

// 精选东京高分美食（人工精选，评分 >4.0；评分为参考性精选标注，非实时抓取）。
// 餐厅是常驻 POI（无开始/结束时间），用独立图层呈现（类似名胜），卡片展示评分 + 招牌菜单。

export type FoodKind = "japanese" | "chinese" | "western" | "cafe" | "dessert";

export const FOOD_KINDS = ["japanese", "chinese", "western", "cafe", "dessert"] as const;

// 菜系元数据：图标徽章配色 + 中文标签 + 白色线性图形（24 viewBox，居中渲染）。
export const FOOD_KIND_META: Record<FoodKind, { label: string; color: string; glyph: string }> = {
  japanese: {
    label: "日式",
    color: "#e11d48",
    glyph: '<path d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M12 4v3M9 6l.6 1.6M15 6l-.6 1.6"/>',
  },
  chinese: {
    label: "中餐",
    color: "#ea580c",
    glyph: '<path d="M3 20 20 4"/><path d="M7 20 21 8"/>',
  },
  western: {
    label: "西餐",
    color: "#2563eb",
    glyph: '<path d="M3 2v7c0 1.1.9 2 2 2a2 2 0 0 0 2-2V2"/><path d="M5 2v20"/><path d="M19 15V2a5 5 0 0 0-3 5v6c0 1.1.9 2 2 2h1Zm0 0v7"/>',
  },
  cafe: {
    label: "咖啡",
    color: "#92400e",
    glyph: '<path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><path d="M6 2v2M10 2v2M14 2v2"/>',
  },
  dessert: {
    label: "甜品",
    color: "#ec4899",
    glyph: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2M12 8v2M17 8v2"/>',
  },
};

export type FoodSpot = {
  id: string;
  name: string;
  kind: FoodKind;
  genre: string; // 细分菜系（卡片展示）
  lat: number;
  lng: number;
  rating: number; // 精选评分（>4.0）
  menu: string[]; // 招牌菜单
  blurb: string; // 一句话简介
};

export const FOOD_SPOTS: FoodSpot[] = [
  // 日式
  { id: "jiro", name: "すきやばし次郎 本店", kind: "japanese", genre: "寿司", lat: 35.6716, lng: 139.7639, rating: 4.1, menu: ["おまかせ握り（約20貫）"], blurb: "银座传奇江户前寿司，米其林三星，需提前预约。" },
  { id: "saito", name: "鮨 さいとう", kind: "japanese", genre: "寿司", lat: 35.6664, lng: 139.7376, rating: 4.2, menu: ["おまかせコース"], blurb: "一席难求的顶级江户前寿司。" },
  { id: "sushisho", name: "すし匠", kind: "japanese", genre: "寿司", lat: 35.6862, lng: 139.7203, rating: 4.1, menu: ["おまかせ（江戸前＋熟成）"], blurb: "四谷名店，熟成与江户前并重。" },
  { id: "kondo", name: "天ぷら 近藤", kind: "japanese", genre: "天妇罗", lat: 35.6719, lng: 139.7636, rating: 4.0, menu: ["天ぷらおまかせ", "薩摩芋の天ぷら"], blurb: "银座天妇罗名店，蔬菜天妇罗一绝。" },
  { id: "ryugin", name: "日本料理 龍吟", kind: "japanese", genre: "现代怀石", lat: 35.6742, lng: 139.7607, rating: 4.2, menu: ["季節のおまかせコース"], blurb: "日比谷世界级现代日本料理。" },
  { id: "kanda", name: "かんだ", kind: "japanese", genre: "怀石", lat: 35.6558, lng: 139.7281, rating: 4.2, menu: ["おまかせ懐石"], blurb: "元麻布米其林三星怀石。" },
  { id: "den", name: "傳 Den", kind: "japanese", genre: "创意日料", lat: 35.6718, lng: 139.7115, rating: 4.2, menu: ["DENTUCKY フライドチキン", "季節のコース"], blurb: "神宫前创意日料，常居亚洲50佳。" },
  { id: "jumbo", name: "焼肉 ジャンボ 白金", kind: "japanese", genre: "烧肉", lat: 35.6432, lng: 139.729, rating: 4.0, menu: ["シャトーブリアン", "ザブトン"], blurb: "白金人气烧肉，和牛厚切惊艳。" },
  { id: "torishiki", name: "鳥しき", kind: "japanese", genre: "烤鸡串", lat: 35.6331, lng: 139.7065, rating: 4.0, menu: ["焼鳥おまかせ"], blurb: "目黑炭火烤鸡，名声极高。" },
  { id: "obana", name: "うなぎ 尾花", kind: "japanese", genre: "鳗鱼", lat: 35.7331, lng: 139.7989, rating: 4.0, menu: ["うな重"], blurb: "南千住百年鳗鱼名店。" },
  { id: "kohaku", name: "麻布 幸村", kind: "japanese", genre: "日本料理", lat: 35.6562, lng: 139.7331, rating: 4.1, menu: ["おまかせ懐石"], blurb: "麻布隐秘的高级割烹。" },
  { id: "koju", name: "銀座 小十", kind: "japanese", genre: "怀石", lat: 35.6706, lng: 139.7662, rating: 4.0, menu: ["季節の懐石"], blurb: "银座米其林怀石。" },
  // 中餐
  { id: "sazenka", name: "茶禅華 Sazenka", kind: "chinese", genre: "中华料理", lat: 35.652, lng: 139.731, rating: 4.1, menu: ["麻婆豆腐", "おまかせコース"], blurb: "南麻布米其林三星，日式手法的中华料理。" },
  { id: "choko", name: "麻布長江", kind: "chinese", genre: "四川料理", lat: 35.6566, lng: 139.7345, rating: 4.0, menu: ["担々麺", "麻婆豆腐"], blurb: "麻布老牌精致川菜。" },
  // 西餐
  { id: "florilege", name: "Florilège", kind: "western", genre: "法餐", lat: 35.6661, lng: 139.7112, rating: 4.1, menu: ["おまかせコース"], blurb: "表参道创新法式料理。" },
  { id: "narisawa", name: "NARISAWA", kind: "western", genre: "创意料理", lat: 35.669, lng: 139.722, rating: 4.0, menu: ["里山のコース"], blurb: "南青山自然系创意法料。" },
  { id: "quintessence", name: "Quintessence", kind: "western", genre: "法餐", lat: 35.6395, lng: 139.7165, rating: 4.1, menu: ["シェフおまかせ"], blurb: "品川顶级法餐，无菜单主厨发办。" },
  // 咖啡
  { id: "bluebottle", name: "Blue Bottle 清澄白河", kind: "cafe", genre: "咖啡", lat: 35.681, lng: 139.799, rating: 4.0, menu: ["シングルオリジン", "ラテ"], blurb: "蓝瓶日本一号店，仓库改造空间。" },
  { id: "sarutahiko", name: "猿田彦珈琲 恵比寿", kind: "cafe", genre: "咖啡", lat: 35.647, lng: 139.71, rating: 4.0, menu: ["深煎りドリップ"], blurb: "惠比寿人气自家烘焙咖啡。" },
  // 甜品
  { id: "higashiya", name: "HIGASHIYA GINZA", kind: "dessert", genre: "和菓子", lat: 35.672, lng: 139.765, rating: 4.0, menu: ["季節の生菓子", "羊羹"], blurb: "银座现代和菓子茶房。" },
  { id: "shiseido", name: "資生堂パーラー 銀座", kind: "dessert", genre: "甜点", lat: 35.67, lng: 139.767, rating: 4.0, menu: ["ストロベリーパフェ"], blurb: "银座百年洋风甜点，草莓芭菲招牌。" },
];

// 精选东京高分美食（人工精选，评分 >4.0；评分为参考性精选标注，非实时抓取）。
// 餐厅是常驻 POI（无开始/结束时间），用独立图层呈现（类似名胜），卡片展示评分 + 招牌菜单。
import { FOOD_SPOTS_IMPORTED } from "./foodSpotsImported";

export type FoodKind = "japanese" | "chinese" | "western" | "cafe" | "dessert" | "other";

export const FOOD_KINDS = ["japanese", "chinese", "western", "cafe", "dessert", "other"] as const;

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
  other: {
    label: "其他",
    color: "#64748b",
    glyph: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>',
  },
};

// 人工精选名店（含参考评分 + 招牌菜单）。
export type FoodSpot = {
  id: string;
  name: string;
  kind: FoodKind;
  genre: string; // 细分菜系（卡片展示）
  lat: number;
  lng: number;
  rating: number; // 精选参考评分（>4.0，人工标注）
  menu: string[]; // 招牌菜单
  blurb: string; // 一句话简介
  budget?: string; // 参考人均（约值，仅供参考）
  station?: string; // 最寄駅
  tips?: string; // 预约/营业小贴士（如「完全予约制」）
};

// Hot Pepper API 导入的真实店（无评分，带预算/照片/官网链接）。kind 用宽松 string 以兼容生成文件。
export type FoodSpotImported = {
  id: string;
  name: string;
  kind: string;
  genre: string;
  lat: number;
  lng: number;
  blurb: string; // Hot Pepper 招牌语(catch)
  budget: string; // 预算区间，如 "3001～4000円"
  station: string; // 最寄駅
  open: string; // 营业时间（已截短）
  amenities: string[]; // 设施标签：個室/禁煙席/Wi-Fi/カード可/ランチ
  photo: string; // 店铺照片 URL
  url: string; // Hot Pepper 店铺页
};

// 地图渲染统一用的形状（精选 + 导入合并后）。可选字段区分两类来源。
export type FoodSpotView = {
  id: string;
  name: string;
  kind: FoodKind;
  genre: string;
  lat: number;
  lng: number;
  rating?: number;
  menu?: string[];
  blurb: string;
  budget?: string;
  station?: string;
  open?: string;
  amenities?: string[];
  tips?: string;
  photo?: string;
  url?: string;
};

export const FOOD_SPOTS: FoodSpot[] = [
  // 日式
  { id: "jiro", name: "すきやばし次郎 本店", kind: "japanese", genre: "寿司", lat: 35.6716, lng: 139.7639, rating: 4.1, menu: ["おまかせ握り（約20貫）"], blurb: "银座传奇江户前寿司，小野二郎主理，曾连年米其林三星，世界最知名的寿司店之一。", budget: "约 ¥40,000~", station: "銀座", tips: "完全予约制，一般经熟客或酒店礼宾介绍" },
  { id: "saito", name: "鮨 さいとう", kind: "japanese", genre: "寿司", lat: 35.6664, lng: 139.7376, rating: 4.2, menu: ["おまかせコース"], blurb: "赤坂顶级江户前寿司，斋藤孝司主理，被誉为东京最难订位的寿司之一。", budget: "约 ¥30,000~", station: "六本木一丁目", tips: "完全予约制，几乎只接受熟客" },
  { id: "sushisho", name: "すし匠", kind: "japanese", genre: "寿司", lat: 35.6862, lng: 139.7203, rating: 4.1, menu: ["おまかせ（江戸前＋熟成）"], blurb: "四谷名店，将江户前传统与熟成手法并重，握寿司前的下酒料理也极受推崇。", budget: "约 ¥30,000~", station: "四ツ谷", tips: "完全予约制" },
  { id: "kondo", name: "天ぷら 近藤", kind: "japanese", genre: "天妇罗", lat: 35.6719, lng: 139.7636, rating: 4.0, menu: ["天ぷらおまかせ", "薩摩芋の天ぷら"], blurb: "银座天妇罗名店，近藤文夫开创蔬菜天妇罗，招牌红薯天妇罗一绝。", budget: "约 ¥12,000~", station: "銀座", tips: "建议提前预约" },
  { id: "ryugin", name: "日本料理 龍吟", kind: "japanese", genre: "现代怀石", lat: 35.6742, lng: 139.7607, rating: 4.2, menu: ["季節のおまかせコース"], blurb: "日比谷世界级现代日本料理，山本征治主厨，融合传统怀石与分子料理，常居亚洲50佳。", budget: "约 ¥40,000~", station: "日比谷", tips: "需提前预约" },
  { id: "kanda", name: "かんだ", kind: "japanese", genre: "怀石", lat: 35.6558, lng: 139.7281, rating: 4.2, menu: ["おまかせ懐石"], blurb: "元麻布米其林三星怀石，神田裕行主理，重视食材本味的正统日本料理。", budget: "约 ¥30,000~", station: "麻布十番", tips: "完全予约制" },
  { id: "den", name: "傳 Den", kind: "japanese", genre: "创意日料", lat: 35.6718, lng: 139.7115, rating: 4.2, menu: ["DENTUCKY フライドチキン", "季節のコース"], blurb: "神宫前创意日料，长谷川在佑主厨，轻松幽默又精致，多次登顶亚洲50佳。", budget: "约 ¥30,000~", station: "外苑前", tips: "极难预约，建议提前数月" },
  { id: "jumbo", name: "焼肉 ジャンボ 白金", kind: "japanese", genre: "烧肉", lat: 35.6432, lng: 139.729, rating: 4.0, menu: ["シャトーブリアン", "ザブトン"], blurb: "白金人气烧肉名店，和牛厚切与夏多布里昂惊艳，性价比与品质兼具。", budget: "约 ¥10,000~", station: "白金高輪", tips: "建议提前预约" },
  { id: "torishiki", name: "鳥しき", kind: "japanese", genre: "烤鸡串", lat: 35.6331, lng: 139.7065, rating: 4.0, menu: ["焼鳥おまかせ"], blurb: "目黑炭火烤鸡名店，池川义辉主理，被誉为东京最难订的烤鸡串之一。", budget: "约 ¥10,000~", station: "目黒", tips: "完全予约制，极难预约" },
  { id: "obana", name: "うなぎ 尾花", kind: "japanese", genre: "鳗鱼", lat: 35.7331, lng: 139.7989, rating: 4.0, menu: ["うな重"], blurb: "南千住百年鳗鱼名店，炭火现烤鳗鱼外酥内嫩，是东京鳗鱼的代表之一。", budget: "约 ¥5,000~", station: "南千住", tips: "不接受预约，常需排队，现金为主" },
  { id: "kohaku", name: "麻布 幸村", kind: "japanese", genre: "日本料理", lat: 35.6562, lng: 139.7331, rating: 4.1, menu: ["おまかせ懐石"], blurb: "麻布十番隐秘的高级割烹，幸村纯主理，曾获米其林三星的正统日本料理。", budget: "约 ¥30,000~", station: "麻布十番", tips: "完全予约制" },
  { id: "koju", name: "銀座 小十", kind: "japanese", genre: "怀石", lat: 35.6706, lng: 139.7662, rating: 4.0, menu: ["季節の懐石"], blurb: "银座米其林怀石，奥田透主理，讲究时令食材与炭火技艺的正统日本料理。", budget: "约 ¥25,000~", station: "銀座", tips: "需提前预约" },
  // 中餐
  { id: "sazenka", name: "茶禅華 Sazenka", kind: "chinese", genre: "中华料理", lat: 35.652, lng: 139.731, rating: 4.1, menu: ["麻婆豆腐", "おまかせコース"], blurb: "南麻布米其林三星，以日式手法演绎中华料理，是日本极少数三星中餐。", budget: "约 ¥25,000~", station: "広尾", tips: "完全予约制，需提前预约" },
  { id: "choko", name: "麻布長江", kind: "chinese", genre: "四川料理", lat: 35.6566, lng: 139.7345, rating: 4.0, menu: ["担々麺", "麻婆豆腐"], blurb: "麻布十番老牌精致川菜，麻婆豆腐与担担面口碑极佳。", budget: "约 ¥10,000~", station: "麻布十番", tips: "建议预约" },
  // 西餐
  { id: "florilege", name: "Florilège", kind: "western", genre: "法餐", lat: 35.6661, lng: 139.7112, rating: 4.1, menu: ["おまかせコース"], blurb: "外苑前创新法式料理，川手宽康主厨，以可持续食材与开放式厨房著称，常居亚洲50佳前列。", budget: "约 ¥20,000~", station: "外苑前", tips: "极难预约，提前开放订位" },
  { id: "narisawa", name: "NARISAWA", kind: "western", genre: "创意料理", lat: 35.669, lng: 139.722, rating: 4.0, menu: ["里山のコース"], blurb: "南青山自然系创意法料，成泽由浩主厨，以「里山」概念诠释日本风土，常居世界50佳。", budget: "约 ¥30,000~", station: "青山一丁目", tips: "需提前预约" },
  { id: "quintessence", name: "Quintessence", kind: "western", genre: "法餐", lat: 35.6395, lng: 139.7165, rating: 4.1, menu: ["シェフおまかせ"], blurb: "御殿山顶级法餐，岸田周三主厨，无菜单主厨发办，长年保持米其林三星。", budget: "约 ¥30,000~", station: "北品川", tips: "完全予约制" },
  // 咖啡
  { id: "bluebottle", name: "Blue Bottle 清澄白河", kind: "cafe", genre: "咖啡", lat: 35.681, lng: 139.799, rating: 4.0, menu: ["シングルオリジン", "ラテ"], blurb: "蓝瓶咖啡日本一号店，由旧仓库改造的明亮空间，主打单品手冲与拿铁。", budget: "约 ¥1,000~", station: "清澄白河", tips: "周末常需排队" },
  { id: "sarutahiko", name: "猿田彦珈琲 恵比寿", kind: "cafe", genre: "咖啡", lat: 35.647, lng: 139.71, rating: 4.0, menu: ["深煎りドリップ"], blurb: "惠比寿人气自家烘焙咖啡，猿田彦珈琲的创始本店，以深焙手冲见长。", budget: "约 ¥1,000~", station: "恵比寿" },
  // 甜品
  { id: "higashiya", name: "HIGASHIYA GINZA", kind: "dessert", genre: "和菓子", lat: 35.672, lng: 139.765, rating: 4.0, menu: ["季節の生菓子", "羊羹"], blurb: "银座现代和菓子茶房，将传统和菓子以当代审美呈现，可搭配日本茶享用。", budget: "约 ¥2,000~", station: "銀座", tips: "茶房建议预约" },
  { id: "shiseido", name: "資生堂パーラー 銀座", kind: "dessert", genre: "甜点", lat: 35.67, lng: 139.767, rating: 4.0, menu: ["ストロベリーパフェ"], blurb: "银座百年洋风甜点老铺，资生堂旗下，招牌草莓芭菲与布丁深受喜爱。", budget: "约 ¥2,000~", station: "銀座" },
];

// 合并：人工精选名店（带评分/招牌菜）+ Hot Pepper 导入真实店（带预算/照片/链接）。
// 地图、AI 导游统一消费 FOOD_SPOTS_ALL。
export const FOOD_SPOTS_ALL: FoodSpotView[] = [
  ...FOOD_SPOTS.map((f) => ({ ...f })),
  ...FOOD_SPOTS_IMPORTED.map((f) => ({
    id: f.id,
    name: f.name,
    kind: (FOOD_KINDS as readonly string[]).includes(f.kind) ? (f.kind as FoodKind) : "japanese",
    genre: f.genre,
    lat: f.lat,
    lng: f.lng,
    blurb: f.blurb,
    budget: f.budget,
    station: f.station,
    open: f.open,
    amenities: f.amenities,
    photo: f.photo,
    url: f.url,
  })),
];

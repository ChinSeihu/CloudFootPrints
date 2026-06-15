// 精选东京高分美食（人工精选，评分 >4.0；评分为参考性精选标注，非实时抓取）。
// 餐厅是常驻 POI（无开始/结束时间），用独立图层呈现（类似名胜），卡片展示评分 + 招牌菜单。

export type FoodSpot = {
  id: string;
  name: string;
  genre: string; // 菜系
  lat: number;
  lng: number;
  rating: number; // 精选评分（>4.0）
  menu: string[]; // 招牌菜单
  blurb: string; // 一句话简介
};

export const FOOD_SPOTS: FoodSpot[] = [
  { id: "jiro", name: "すきやばし次郎 本店", genre: "寿司", lat: 35.6716, lng: 139.7639, rating: 4.1, menu: ["おまかせ握り（約20貫）"], blurb: "银座传奇江户前寿司，米其林三星，需提前预约。" },
  { id: "saito", name: "鮨 さいとう", genre: "寿司", lat: 35.6664, lng: 139.7376, rating: 4.2, menu: ["おまかせコース"], blurb: "一席难求的顶级江户前寿司。" },
  { id: "sushisho", name: "すし匠", genre: "寿司", lat: 35.6862, lng: 139.7203, rating: 4.1, menu: ["おまかせ（江戸前＋熟成）"], blurb: "四谷名店，熟成与江户前并重。" },
  { id: "kondo", name: "天ぷら 近藤", genre: "天妇罗", lat: 35.6719, lng: 139.7636, rating: 4.0, menu: ["天ぷらおまかせ", "薩摩芋の天ぷら"], blurb: "银座天妇罗名店，蔬菜天妇罗一绝。" },
  { id: "ryugin", name: "日本料理 龍吟", genre: "现代怀石", lat: 35.6742, lng: 139.7607, rating: 4.2, menu: ["季節のおまかせコース"], blurb: "日比谷世界级现代日本料理。" },
  { id: "kanda", name: "かんだ", genre: "怀石", lat: 35.6558, lng: 139.7281, rating: 4.2, menu: ["おまかせ懐石"], blurb: "元麻布米其林三星怀石。" },
  { id: "den", name: "傳 Den", genre: "创意日料", lat: 35.6718, lng: 139.7115, rating: 4.2, menu: ["DENTUCKY フライドチキン", "季節のコース"], blurb: "神宫前创意日料，常居亚洲50佳。" },
  { id: "florilege", name: "Florilège", genre: "法餐", lat: 35.6661, lng: 139.7112, rating: 4.1, menu: ["おまかせコース"], blurb: "表参道创新法式料理。" },
  { id: "narisawa", name: "NARISAWA", genre: "创意料理", lat: 35.669, lng: 139.722, rating: 4.0, menu: ["里山のコース"], blurb: "南青山自然系创意料理。" },
  { id: "jumbo", name: "焼肉 ジャンボ 白金", genre: "烧肉", lat: 35.6432, lng: 139.729, rating: 4.0, menu: ["シャトーブリアン", "ザブトン"], blurb: "白金人气烧肉，和牛厚切惊艳。" },
  { id: "torishiki", name: "鳥しき", genre: "烤鸡串", lat: 35.6331, lng: 139.7065, rating: 4.0, menu: ["焼鳥おまかせ"], blurb: "目黑炭火烤鸡，名声极高。" },
  { id: "obana", name: "うなぎ 尾花", genre: "鳗鱼", lat: 35.7331, lng: 139.7989, rating: 4.0, menu: ["うな重"], blurb: "南千住百年鳗鱼名店。" },
  { id: "kohaku", name: "麻布 幸村", genre: "日本料理", lat: 35.6562, lng: 139.7331, rating: 4.1, menu: ["おまかせ懐石"], blurb: "麻布隐秘的高级割烹。" },
  { id: "koju", name: "銀座 小十", genre: "怀石", lat: 35.6706, lng: 139.7662, rating: 4.0, menu: ["季節の懐石"], blurb: "银座米其林怀石。" },
];

// 东京主要名胜 / 地标 / 公园（精选静态数据，用于在地图上标识景点）。
// 坐标为大致点位，仅作装饰/导览标识；非活动数据。

export type LandmarkKind = "tower" | "shrine" | "park" | "castle" | "museum" | "landmark";

export type Landmark = {
  id: string;
  name: string; // 显示名（中/日）
  lat: number;
  lng: number;
  kind: LandmarkKind;
  blurb: string; // 一句话简介（卡片展示用）
};

// 类型 → 颜色 + 中文标签（图标徽章用色）
export const LANDMARK_KIND_META: Record<LandmarkKind, { color: string; label: string }> = {
  tower: { color: "#e0567a", label: "地标塔" },
  shrine: { color: "#d97706", label: "神社寺院" },
  park: { color: "#16a34a", label: "公园庭园" },
  castle: { color: "#7c3aed", label: "城/宫" },
  museum: { color: "#2563eb", label: "博物馆/美术馆" },
  landmark: { color: "#0891b2", label: "名胜地标" },
};

export const LANDMARKS: Landmark[] = [
  // 塔 / 展望
  { id: "tokyo-tower", name: "東京タワー", lat: 35.6586, lng: 139.7454, kind: "tower", blurb: "1958 年建成的红白铁塔，东京经典地标，可登展望台俯瞰市区夜景。" },
  { id: "skytree", name: "東京スカイツリー", lat: 35.7101, lng: 139.8107, kind: "tower", blurb: "634 米电波塔，世界最高自立式铁塔之一，展望回廊视野极佳。" },
  { id: "tocho", name: "都庁展望室", lat: 35.6896, lng: 139.6917, kind: "tower", blurb: "新宿都厅 45 层免费展望室，晴天可远眺富士山。" },
  { id: "rainbow-bridge", name: "レインボーブリッジ", lat: 35.6365, lng: 139.7634, kind: "landmark", blurb: "连接台场与都心的吊桥，夜间点灯格外浪漫。" },
  // 神社 / 寺
  { id: "sensoji", name: "浅草寺", lat: 35.7148, lng: 139.7967, kind: "shrine", blurb: "东京最古老的寺院，雷门与仲见世商店街人气极高。" },
  { id: "meiji", name: "明治神宮", lat: 35.6764, lng: 139.6993, kind: "shrine", blurb: "供奉明治天皇的神社，被原宿旁茂密森林环抱。" },
  { id: "kanda", name: "神田明神", lat: 35.7019, lng: 139.7679, kind: "shrine", blurb: "守护神田、秋叶原一带的古社，常有祈福参拜。" },
  { id: "zojoji", name: "増上寺", lat: 35.6575, lng: 139.748, kind: "shrine", blurb: "德川家菩提寺，背景正对东京塔，景观独特。" },
  { id: "yasukuni", name: "靖国神社", lat: 35.6939, lng: 139.7438, kind: "shrine", blurb: "东京樱花名所之一，春季境内染井吉野樱盛开。" },
  // 公园 / 庭园
  { id: "ueno", name: "上野恩賜公園", lat: 35.7156, lng: 139.7745, kind: "park", blurb: "博物馆与动物园云集的大公园，著名赏樱地。" },
  { id: "shinjuku-gyoen", name: "新宿御苑", lat: 35.6852, lng: 139.71, kind: "park", blurb: "融合日式、英式、法式造园的大型庭园，四季皆美。" },
  { id: "yoyogi", name: "代々木公園", lat: 35.6716, lng: 139.6949, kind: "park", blurb: "原宿旁开阔草地公园，周末常有市集与活动。" },
  { id: "hamarikyu", name: "浜離宮庭園", lat: 35.6597, lng: 139.7634, kind: "park", blurb: "江户大名庭园，潮入池与摩天楼背景相映成趣。" },
  { id: "rikugien", name: "六義園", lat: 35.7329, lng: 139.7468, kind: "park", blurb: "江户回游式庭园，红叶与枝垂樱夜间点灯闻名。" },
  { id: "korakuen", name: "小石川後楽園", lat: 35.7056, lng: 139.751, kind: "park", blurb: "东京最古老庭园之一，融汇中日造园意趣。" },
  { id: "inokashira", name: "井の頭公園", lat: 35.6999, lng: 139.5703, kind: "park", blurb: "吉祥寺旁人气公园，池畔天鹅船与樱花动人。" },
  // 城 / 宫
  { id: "imperial", name: "皇居", lat: 35.6852, lng: 139.7528, kind: "castle", blurb: "江户城旧址，今为皇室居所，外苑与东御苑可参观。" },
  // 博物馆 / 美术馆
  { id: "tnm", name: "東京国立博物館", lat: 35.7188, lng: 139.7765, kind: "museum", blurb: "日本最大的综合博物馆，国宝级馆藏众多。" },
  { id: "kahaku", name: "国立科学博物館", lat: 35.7163, lng: 139.7766, kind: "museum", blurb: "上野的自然科学博物馆，恐龙化石与互动展受欢迎。" },
  { id: "nmwa", name: "国立西洋美術館", lat: 35.7155, lng: 139.7757, kind: "museum", blurb: "勒·柯布西耶设计的世界遗产建筑，藏西洋名画。" },
  { id: "mori", name: "森美術館", lat: 35.6604, lng: 139.7292, kind: "museum", blurb: "六本木之丘高层的现代艺术馆，常办话题特展。" },
  { id: "teamlab-planets", name: "teamLab Planets", lat: 35.6485, lng: 139.7905, kind: "museum", blurb: "丰洲的沉浸式数字艺术馆，赤足穿行光影空间。" },
  // 名胜 / 地标
  { id: "shibuya", name: "渋谷スクランブル交差点", lat: 35.6595, lng: 139.7004, kind: "landmark", blurb: "世界闻名的全向十字路口，汹涌人潮即是风景。" },
  { id: "tokyo-station", name: "東京駅", lat: 35.6812, lng: 139.7671, kind: "landmark", blurb: "红砖丸之内站舍为重要文化财，购物美食齐全。" },
  { id: "odaiba", name: "お台場", lat: 35.6309, lng: 139.78, kind: "landmark", blurb: "临海娱乐区，购物、海滨与夜景一应俱全。" },
  { id: "ameyoko", name: "アメ横", lat: 35.71, lng: 139.774, kind: "landmark", blurb: "上野热闹商店街，海鲜、杂货与小吃的廉价天堂。" },
];

// 各类型的白色内部图形（线性，居中于 0,0，约 ±7 范围）。
export const LANDMARK_GLYPH: Record<LandmarkKind, string> = {
  tower: `<path d="M0 -7 L4.5 7 H-4.5 Z"/><path d="M-2.5 0 H2.5"/>`,
  shrine: `<path d="M-6 -4 H6"/><path d="M-7 -1 H7"/><path d="M-4 -1 V6"/><path d="M4 -1 V6"/>`,
  park: `<circle cx="0" cy="-2" r="4.5"/><path d="M0 2.5 V7"/>`,
  castle: `<path d="M-6 7 V0 H6 V7"/><path d="M-7.5 0 L0 -6.5 L7.5 0"/>`,
  museum: `<path d="M-7 -3 L0 -7 L7 -3"/><path d="M-5 -1 V5 M-1.5 -1 V5 M1.5 -1 V5 M5 -1 V5"/><path d="M-7 7 H7"/>`,
  landmark: `<path d="M0 -7 L1.9 -2.2 L7 -2 L3 1.3 L4.3 6.5 L0 3.4 L-4.3 6.5 L-3 1.3 L-7 -2 L-1.9 -2.2 Z"/>`,
};

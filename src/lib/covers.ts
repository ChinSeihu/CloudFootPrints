// 预设资料卡背景图：克劳德·莫奈作品（公有领域，来自 Wikimedia Commons）。
// 用 Special:FilePath（稳定、支持 width 缩放）。资料卡会压暗色遮罩，文字仍清晰。

const fp = (name: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1000`;

export type PresetCover = { id: string; name: string; url: string };

// 偏向色彩绚烂的风景画（稻草堆 / 火车站 / 罂粟花田 / 春日等），均为公有领域且已验证可加载。
export const PRESET_COVERS: PresetCover[] = [
  { id: "wheatstacks", name: "稻草堆·夏末", url: fp("Wheatstacks_(End_of_Summer),_1890-91_(190_Kb);_Oil_on_canvas,_60_x_100_cm_(23_5-8_x_39_3-8_in),_The_Art_Institute_of_Chicago.jpg") },
  { id: "poppies", name: "罂粟花田", url: fp("Claude_Monet_038.jpg") },
  { id: "gare", name: "圣拉扎尔火车站", url: fp("Claude_Monet_-_Arrival_of_the_Normandy_Train,_Gare_Saint-Lazare_-_Google_Art_Project.jpg") },
  { id: "springtime", name: "春日", url: fp("Claude_Monet_-_Springtime_-_Walters_3711.jpg") },
  { id: "haystacks", name: "干草堆·夏末", url: fp("Claude_Monet_-_Haystacks,_end_of_Summer_-_Google_Art_Project.jpg") },
  { id: "sunrise", name: "日出·印象", url: fp("Claude_Monet,_Impression,_soleil_levant.jpg") },
];

// 新用户默认背景（稻草堆，暖金色、文字易读）
export const DEFAULT_COVER = PRESET_COVERS[0].url;

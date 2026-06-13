// 预设资料卡背景图：克劳德·莫奈作品（公有领域，来自 Wikimedia Commons）。
// 用 Special:FilePath（稳定、支持 width 缩放）。资料卡会压暗色遮罩，文字仍清晰。

const fp = (name: string) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1000`;

export type PresetCover = { id: string; name: string; url: string };

export const PRESET_COVERS: PresetCover[] = [
  { id: "lilies", name: "睡莲", url: fp("Claude_Monet_-_Water_Lilies_-_Google_Art_Project.jpg") },
  { id: "sunrise", name: "日出·印象", url: fp("Claude_Monet,_Impression,_soleil_levant.jpg") },
  { id: "lilies1906", name: "睡莲·1906", url: fp("Claude_Monet_-_Water_Lilies_-_1906,_Ryerson.jpg") },
  { id: "parasol", name: "撑阳伞的女人", url: fp("Claude_Monet_-_Woman_with_a_Parasol_-_Madame_Monet_and_Her_Son_-_Google_Art_Project.jpg") },
  { id: "garden", name: "圣阿德雷斯花园", url: fp("Claude_Monet_-_Jardin_à_Sainte-Adresse.jpg") },
  { id: "magpie", name: "喜鹊", url: fp("Claude_Monet_-_The_Magpie_-_Google_Art_Project.jpg") },
];

// 新用户默认背景（睡莲）
export const DEFAULT_COVER = PRESET_COVERS[0].url;

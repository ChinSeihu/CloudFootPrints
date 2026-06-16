import type { Source } from "../types";
import { walkerplusSources, walkerplusSportsSources, walkerplusLiveSources } from "./walkerplus";
import { jalanSources } from "./jalan";
import { tokyoOpenDataSource } from "./tokyoOpenData";
import { connpassSource } from "./connpass";
import { sampleFixturesSource } from "./sampleFixtures";

// 数据源注册表。新增源：实现 Source 接口后加到这里即可，无需改动管线。
// walkerplus / jalan = 首都圈四县（东京/神奈川/埼玉/千叶）活动主力源（解析页面 JSON-LD）；
// walkerplus-sports / -live = 体育/演唱会子分类（各县）；其余按需配置/兜底。
export function getSources(): Source[] {
  return [
    ...walkerplusSources,
    ...walkerplusSportsSources,
    ...walkerplusLiveSources,
    ...jalanSources,
    tokyoOpenDataSource,
    connpassSource,
    sampleFixturesSource,
  ];
}

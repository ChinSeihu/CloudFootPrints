import type { Source } from "../types";
import { walkerplusSource } from "./walkerplus";
import { tokyoOpenDataSource } from "./tokyoOpenData";
import { connpassSource } from "./connpass";
import { sampleFixturesSource } from "./sampleFixtures";

// 数据源注册表。新增源：实现 Source 接口后加到这里即可，无需改动管线。
// walkerplus = 真实东京活动主力源（解析页面 JSON-LD）；其余按需配置/兜底。
export function getSources(): Source[] {
  return [walkerplusSource, tokyoOpenDataSource, connpassSource, sampleFixturesSource];
}

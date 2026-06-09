import type { Source } from "../types";
import { tokyoOpenDataSource } from "./tokyoOpenData";
import { connpassSource } from "./connpass";
import { sampleFixturesSource } from "./sampleFixtures";

// 数据源注册表。新增源：实现 Source 接口后加到这里即可，无需改动管线。
export function getSources(): Source[] {
  return [tokyoOpenDataSource, connpassSource, sampleFixturesSource];
}

import sharp from "sharp";
import { mkdirSync } from "node:fs";

// 把 person.png（1536x1024，6列x2行，每格 256x512）裁成 12 张单人参考图。
// 只取每格中间的「图形带」（正/背全身），跳过顶部名牌与底部规格文字。
const SRC = "public/person.png";
const COLS = 6, CW = 256, CH = 512;
const FIG_TOP = 92, FIG_H = 318; // 图形带相对每格顶部的偏移与高度

(async () => {
  mkdirSync("public/refs", { recursive: true });
  for (let i = 1; i <= 12; i++) {
    const col = (i - 1) % COLS, row = Math.floor((i - 1) / COLS);
    const left = col * CW, top = row * CH + FIG_TOP;
    const name = String(i).padStart(2, "0");
    await sharp(SRC).extract({ left, top, width: CW, height: FIG_H }).toFile(`public/refs/${name}.png`);
  }
  console.log("12 张单人参考图已裁到 public/refs/01.png … 12.png");
})();

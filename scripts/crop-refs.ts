import { mkdirSync } from "node:fs";
import sharp from "sharp";

type Crop = {
  id: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

const SRC = "public/personV2.png";
const OUT_DIR = "public/refs";

// personV2.png is a 1536x1024 visual sheet with 13 persona cards.
// These boxes crop the main portrait/photo area from each card and avoid labels,
// thumbnails, text, and color swatches.
const CROPS: Crop[] = [
  { id: 1, left: 15, top: 126, width: 230, height: 157 },
  { id: 2, left: 262, top: 126, width: 230, height: 157 },
  { id: 3, left: 509, top: 126, width: 230, height: 157 },
  { id: 4, left: 756, top: 126, width: 230, height: 157 },
  { id: 5, left: 1003, top: 126, width: 160, height: 171 },
  { id: 6, left: 1172, top: 126, width: 162, height: 171 },
  { id: 7, left: 1345, top: 126, width: 162, height: 171 },
  { id: 8, left: 15, top: 592, width: 230, height: 166 },
  { id: 9, left: 262, top: 592, width: 230, height: 166 },
  { id: 10, left: 509, top: 592, width: 230, height: 166 },
  { id: 11, left: 756, top: 592, width: 230, height: 166 },
  { id: 12, left: 1003, top: 592, width: 230, height: 166 },
  { id: 13, left: 1249, top: 592, width: 258, height: 166 },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const crop of CROPS) {
    const name = String(crop.id).padStart(2, "0");
    await sharp(SRC)
      .extract({
        left: crop.left,
        top: crop.top,
        width: crop.width,
        height: crop.height,
      })
      .toFile(`${OUT_DIR}/${name}.png`);
  }

  console.log(`Cropped ${CROPS.length} persona refs from ${SRC} into ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

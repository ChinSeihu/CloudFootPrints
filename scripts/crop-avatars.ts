import { mkdirSync } from "node:fs";
import sharp from "sharp";

const IN_DIR = "public/refs";
const OUT_DIR = "public/avatars/persona-v2";
const SIZE = 320;

type AvatarCrop = {
  id: number;
  left: number;
  top: number;
  size: number;
};

// Manual square crops from public/refs/*.png. The source refs are wider scene
// crops, so fixed per-person boxes keep the face centered in circular avatars.
const CROPS: AvatarCrop[] = [
  { id: 1, left: 18, top: 0, size: 157 },
  { id: 2, left: 30, top: 0, size: 157 },
  { id: 3, left: 32, top: 0, size: 157 },
  { id: 4, left: 45, top: 0, size: 157 },
  { id: 5, left: 0, top: 0, size: 160 },
  { id: 6, left: 0, top: 0, size: 162 },
  { id: 7, left: 0, top: 0, size: 162 },
  { id: 8, left: 10, top: 0, size: 166 },
  { id: 9, left: 38, top: 0, size: 166 },
  { id: 10, left: 40, top: 0, size: 166 },
  { id: 11, left: 44, top: 0, size: 166 },
  { id: 12, left: 64, top: 0, size: 166 },
  { id: 13, left: 72, top: 0, size: 166 },
];

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const crop of CROPS) {
    const name = String(crop.id).padStart(2, "0");
    await sharp(`${IN_DIR}/${name}.png`)
      .extract({
        left: crop.left,
        top: crop.top,
        width: crop.size,
        height: crop.size,
      })
      .resize(SIZE, SIZE)
      .png()
      .toFile(`${OUT_DIR}/${name}.png`);
  }

  console.log(`Cropped ${CROPS.length} PersonaV2 avatars into ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { mkdirSync } from "node:fs";
import sharp from "sharp";

const IN_DIR = "public/refs";
const OUT_DIR = "public/avatars/persona-v2";
const SIZE = 320;
const COUNT = 13;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (let id = 1; id <= COUNT; id++) {
    const name = String(id).padStart(2, "0");
    await sharp(`${IN_DIR}/${name}.png`)
      .resize(SIZE, SIZE, {
        fit: "cover",
        position: sharp.strategy.attention,
      })
      .png()
      .toFile(`${OUT_DIR}/${name}.png`);
  }

  console.log(`Cropped ${COUNT} PersonaV2 avatars into ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

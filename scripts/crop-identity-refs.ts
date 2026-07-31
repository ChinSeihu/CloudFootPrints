import { mkdirSync } from "node:fs";
import sharp from "sharp";

const IN_DIR = "public/avatars/persona-v2";
const OUT_DIR = "public/identity-refs";

type IdentityCrop = {
  id: number;
  left: number;
  width: number;
};

// Crop the face and hairstyle from square avatars so generated scenes do not
// inherit the reference clothing, accessories, props or background composition.
const CROPS: IdentityCrop[] = Array.from({ length: 13 }, (_, index) => {
  const id = index + 1;
  if (id === 6) return { id, left: 80, width: 190 };
  if (id === 12) return { id, left: 70, width: 200 };
  return { id, left: 50, width: 220 };
});

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  for (const crop of CROPS) {
    const name = String(crop.id).padStart(2, "0");
    await sharp(`${IN_DIR}/${name}.png`)
      .extract({ left: crop.left, top: 0, width: crop.width, height: 190 })
      .resize({ width: 352 })
      .png()
      .toFile(`${OUT_DIR}/${name}.png`);
  }

  console.log(`Cropped ${CROPS.length} identity references into ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

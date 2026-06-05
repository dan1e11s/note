import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const source = readFileSync(join(publicDir, "icon.svg"));

const targets = [
  ["pwa-192x192.png", 192],
  ["pwa-512x512.png", 512],
  ["maskable-512x512.png", 512],
  ["apple-touch-icon.png", 180]
];

for (const [name, size] of targets) {
  await sharp(source).resize(size, size).png().toFile(join(publicDir, name));
}

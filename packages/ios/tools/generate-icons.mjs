// 代码生成 iOS App Icon（高端极简风：纯色底 + 白字）
//
// 运行： npm run generate

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_IOS = path.resolve(__dirname, "..");

const FONT_PATH = "C:/Windows/Fonts/simhei.ttf";
const font = opentype.loadSync(FONT_PATH);

const SIZE = 1024;
const BG_COLOR = "#0f172a";

function centeredGlyphPath(char, fontSize, opticalShiftY = 0) {
  const raw = font.getPath(char, 0, 0, fontSize);
  const bbox = raw.getBoundingBox();
  const glyphW = bbox.x2 - bbox.x1;
  const glyphH = bbox.y2 - bbox.y1;
  const tx = (SIZE - glyphW) / 2 - bbox.x1;
  const ty = (SIZE - glyphH) / 2 - bbox.y1 + opticalShiftY;
  const placed = font.getPath(char, tx, ty, fontSize);
  return placed.toPathData(2);
}

function buildSVG(char) {
  const glyphPath = centeredGlyphPath(char, 680, -24);

  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"
     xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" fill="${BG_COLOR}"/>
  <path d="${glyphPath}" fill="#ffffff"/>
</svg>`;
}

const ICONS = [
  {
    name: "高中",
    char: "高",
    out: path.join(REPO_IOS, "ios-gaokao/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png"),
  },
];

for (const icon of ICONS) {
  const svg = buildSVG(icon.char);
  fs.writeFileSync(icon.out.replace(/icon-1024\.png$/, "icon-source.svg"), svg, "utf8");

  await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE)
    .flatten({ background: BG_COLOR })
    .removeAlpha()
    .png()
    .toFile(icon.out);

  console.log(`\u2713 ${icon.name}: ${icon.out}`);
}
console.log("全部完成。");

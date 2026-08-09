// 生成内置样例的 SVG 与 PNG 预览（PNG 依赖工作区中的 sharp，仅用于本地预览）。
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { renderSVG } from "../src/render.ts";
import { samples, sampleNames } from "../src/samples.ts";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const workspace = resolve(root, "../..");
const outDir = join(root, "preview");

await mkdir(outDir, { recursive: true });

let sharp = null;
try {
  const sharpPath = require.resolve("sharp", {
    paths: [join(workspace, "node_modules/.pnpm/node_modules")],
  });
  sharp = require(sharpPath);
} catch {
  console.warn("sharp 不可用，仅生成 SVG 预览");
}

for (const name of sampleNames) {
  const svg = renderSVG(samples[name]);
  await writeFile(join(outDir, `${name}.svg`), svg, "utf8");
  if (sharp) {
    await sharp(Buffer.from(svg)).png().toFile(join(outDir, `${name}.png`));
  }
}

console.log(`预览已生成：${outDir}`);

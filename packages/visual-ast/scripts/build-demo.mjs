// 把 demo 入口打包为单文件 ESM（demo/visual-ast-demo.js），供静态页面直接打开。
// 依赖工作区中的 esbuild，仅用于本地构建。
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const workspace = resolve(root, "../..");

const esbuildPath = require.resolve("esbuild", {
  paths: [join(workspace, "node_modules/.pnpm/node_modules")],
});
const esbuild = require(esbuildPath);

await esbuild.build({
  entryPoints: [join(root, "demo", "demo-entry.ts")],
  bundle: true,
  format: "esm",
  outfile: join(root, "demo", "visual-ast-demo.js"),
  target: "es2022",
  logLevel: "info",
});

console.log("demo 已构建：packages/visual-ast/demo/visual-ast-demo.js");

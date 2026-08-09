import { renderSVG } from "../src/render.ts";
import { samples, sampleNames } from "../src/samples.ts";
import { validateGeometryAst } from "../src/validate.ts";

const nav = document.getElementById("nav") as HTMLElement;
const preview = document.getElementById("preview") as HTMLElement;
const json = document.getElementById("json") as HTMLTextAreaElement;
const status = document.getElementById("status") as HTMLElement;

let current: string = sampleNames[0];

function render(): void {
  const raw = json.value;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    status.className = "error";
    status.textContent = `JSON 解析失败：${(err as Error).message}`;
    return;
  }
  const validation = validateGeometryAst(parsed);
  if (!validation.ok) {
    status.className = "error";
    status.textContent = `校验失败（${validation.errors.length} 处）：\n${validation.errors.slice(0, 8).join("\n")}`;
    return;
  }
  preview.innerHTML = renderSVG(parsed as Parameters<typeof renderSVG>[0]);
  status.className = "ok";
  status.textContent = "✓ 校验通过 · 已渲染";
}

function select(name: string): void {
  current = name;
  json.value = JSON.stringify(samples[name], null, 2);
  render();
  for (const btn of nav.querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.name === name);
  }
}

for (const name of sampleNames) {
  const btn = document.createElement("button");
  btn.dataset.name = name;
  btn.textContent = name;
  btn.addEventListener("click", () => select(name));
  nav.appendChild(btn);
}

json.addEventListener("input", render);
select(current);

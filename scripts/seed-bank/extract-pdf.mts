// Step 1: extract raw text from exam source material into tmp/seed/text/.
// Layouts under 试卷/高考/:
//  - 2024/: flat PDFs, some combined paper+answers (真题…参考答案 / 试卷(含答案))
//  - 2025/: flat PDF pairs (试卷 + 答案)
//  - 2026/: per-subject dirs with txt (paper) and/or PDFs (paper / 参考答案); 评析 files are commentary
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pdfParse, EXAM_DIR, TMP_SEED, readTextSmart, subjectFromFileName } from './lib.mts';

const force = process.argv.includes('--force');
const outDir = join(TMP_SEED, 'text');
mkdirSync(outDir, { recursive: true });

type Kind = 'paper' | 'answers';

/** null = not exam content (commentary/metadata). 'combined' = one file holding paper + answers. */
function detectKind(fileName: string): Kind | 'combined' | null {
  if (/评析|状态|来源/.test(fileName)) return null;
  const isPaperShell = /试卷|真题|试题/.test(fileName);
  const hasAnswer = /答案/.test(fileName);
  if (isPaperShell && hasAnswer) return 'combined';
  if (isPaperShell) return 'paper';
  if (hasAnswer) return 'answers';
  return null;
}

const cjkCount = (text: string) => (text.match(/[\u4e00-\u9fff]/g) ?? []).length;

/** Real papers are >4KB of text; shorter output means a scanned/image PDF that
 *  pdf-parse cannot read — skip instead of writing a useless fragment. */
const MIN_TEXT_CHARS = 1000;

async function extractPdf(pdfPath: string, outName: string): Promise<void> {
  const buf = readFileSync(pdfPath);
  const parser = new pdfParse.PDFParse({ data: new Uint8Array(buf) });
  try {
    const res = await parser.getText();
    const text = res.text ?? '';
    if (text.length < MIN_TEXT_CHARS) {
      console.warn(`${outName}: only ${text.length} chars — likely scanned/image PDF, skipped (needs OCR)`);
      return;
    }
    writeFileSync(join(outDir, outName), text, 'utf8');
    console.log(`${outName}: ${text.length} chars (cjk ${cjkCount(text)})`);
  } finally {
    await parser.destroy();
  }
}

function extractTxt(path: string, outName: string): void {
  const text = readTextSmart(path);
  if (text.length < MIN_TEXT_CHARS) {
    console.warn(`${outName}: only ${text.length} chars — source too short, skipped`);
    return;
  }
  writeFileSync(join(outDir, outName), text, 'utf8');
  console.log(`${outName}: ${text.length} chars (cjk ${cjkCount(text)})`);
}

async function processFile(year: number, fileName: string, filePath: string): Promise<void> {
  const subject = subjectFromFileName(fileName);
  if (!subject) {
    console.warn(`skip (no subject in name): ${fileName}`);
    return;
  }
  const kind = detectKind(fileName);
  if (!kind) {
    console.warn(`skip (commentary/metadata): ${fileName}`);
    return;
  }
  const lower = fileName.toLowerCase();
  const isPdf = lower.endsWith('.pdf');
  const isTxt = lower.endsWith('.txt');
  if (!isPdf && !isTxt) {
    console.warn(`skip (unsupported extension): ${fileName}`);
    return;
  }
  const kinds: Kind[] = kind === 'combined' ? ['paper', 'answers'] : [kind];
  for (const k of kinds) {
    const outName = `${year}-${subject}-${k}.txt`;
    if (!force && existsSync(join(outDir, outName))) {
      console.log(`${outName}: exists, skip`);
      continue;
    }
    if (isPdf) await extractPdf(filePath, outName);
    else extractTxt(filePath, outName);
  }
}

async function main(): Promise<void> {
  for (const year of [2024, 2025, 2026]) {
    const dir = join(EXAM_DIR, '高考', String(year));
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      let isDir = false;
      try {
        isDir = statSync(path).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        // 2026-style: per-subject dir. .md files are status/commentary notes, not papers.
        for (const file of readdirSync(path).sort()) {
          if (!file.toLowerCase().endsWith('.pdf') && !file.toLowerCase().endsWith('.txt')) continue;
          await processFile(year, file, join(path, file));
        }
      } else {
        await processFile(year, entry, path);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Cross-check LLM-extracted 选择题 answers against deterministic signals in the
// source answers text: 【答案】X markers and 故选：X conclusions.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TMP_SEED } from './lib.mts';

const entries = readFileSync(join(TMP_SEED, 'entries.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

function answerSignals(text: string): Map<number, { marker: string | null; verdict: string | null }> {
  const signals = new Map<number, { marker: string | null; verdict: string | null }>();
  const set = (no: number, kind: 'marker' | 'verdict', value: string | null) => {
    const cur = signals.get(no) ?? { marker: null, verdict: null };
    if (kind === 'marker') cur.marker = value;
    else cur.verdict = value;
    signals.set(no, cur);
  };

  // Format 1: per-question blocks with 【答案】X / 故选：X (2025 answer keys).
  const marks: Array<{ no: number; start: number }> = [];
  // (?!\d) rejects decimals like "4.096" being read as question 4.
  const re = /(?:^|\n)\s*(\d{1,2})\s*[.．、](?!\d)[^\n]*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const no = Number(m[1]);
    // Real papers number questions once: keep only the first occurrence.
    if (!marks.some((x) => x.no === no)) marks.push({ no, start: m.index });
  }
  for (let i = 0; i < marks.length; i += 1) {
    const end = i + 1 < marks.length ? marks[i + 1]!.start : text.length;
    const block = text.slice(marks[i]!.start, end);
    const marker = block.match(/【答案】\s*([A-D]{1,4})/);
    const verdict = block.match(/故选[：:]\s*([A-D])/);
    if (marker) set(marks[i]!.no, 'marker', marker[1]!);
    if (verdict) set(marks[i]!.no, 'verdict', verdict[1]!);
  }

  // Format 2: summary table "题号 1..10 / 答案 B A B..." (2026 answer key).
  const table = text.match(/题号\s*((?:\d+\s*)+)\n\s*答案\s*((?:[A-D]{1,4}[\s,，、]*)+)/);
  if (table) {
    const nums = table[1]!.trim().split(/\s+/).map(Number);
    const letters = table[2]!.trim().split(/[\s,，、]+/);
    if (nums.length === letters.length) {
      nums.forEach((no, i) => set(no, 'marker', letters[i]!));
    }
  }

  // Format 2b: short per-question verdicts like "1．B".
  const short = text.matchAll(/(?:^|\n)\s*(\d{1,2})\s*[.．、]\s*([A-D]{1,4})\s*(?=\n|$)/g);
  for (const s of short) set(Number(s[1]), 'verdict', s[2]!);

  return signals;
}

let checked = 0;
let mismatches = 0;
for (const year of [2025, 2026]) {
  for (const subj of ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理']) {
    const ansPath = join(TMP_SEED, 'text', `${year}-${subj}-answers.txt`);
    let text: string;
    try {
      text = readFileSync(ansPath, 'utf8');
    } catch {
      continue;
    }
    const signals = answerSignals(text);
    for (const e of entries) {
      if (e.year !== year || e.subject !== subj || e.questionType !== '选择题' || !e.answer) continue;
      const no = Number(e.ref.slice(-2));
      const s = signals.get(no);
      if (!s) continue;
      const letters = e.answer.replace(/[^A-D]/g, '');
      for (const [kind, source] of [['【答案】', s.marker], ['故选', s.verdict]] as const) {
        if (!source) continue;
        checked += 1;
        if (source !== letters) {
          mismatches += 1;
          console.log(`MISMATCH ${e.id} ${kind}: source=${source} entry=${letters}`);
        }
      }
    }
  }
}
console.log(`checked ${checked} signals from source answer keys, ${mismatches} mismatches`);

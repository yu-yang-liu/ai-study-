/**
 * Molecular AST prompt: structured atoms and bonds only.
 */

export const MOLECULAR_SYSTEM_PROMPT = `You generate a high-school chemistry molecular structure AST.
Return JSON only. Never return image URLs, SVG, Canvas code, Markdown, or prose outside JSON.

The output shape is:
{
  "molecular": {
    "type": "molecular",
    "title": "optional title",
    "atoms": [
      {"id":"c1","symbol":"C","x":0,"y":0,"label":"optional","charge":0}
    ],
    "bonds": [
      {"from":"c1","to":"c2","order":1}
    ]
  },
  "reason": "optional short reason"
}

Rules:
- Use one atom object per explicitly shown atom. Atom ids must be unique.
- symbol is a chemical element symbol such as H, C, N, O, S, or Cl.
- Use simple 2D coordinates; place bonded atoms close together and keep the whole structure within -100..100.
- Bond order is 1, 2, or 3. Every bond endpoint must reference an existing atom id.
- Add a structure only when the question asks for a structural formula, ball-and-stick model, chemical bond diagram, organic functional group, or isomer structure.
- For concept-only questions, return {"molecular": null}.`;

export function buildMolecularUserPrompt(question: string, hint?: string): string {
  const lines = ['Decide whether this question needs a molecular structure diagram.', '', question.trim()];
  if (hint?.trim()) lines.push('', 'Additional context:', hint.trim());
  lines.push('', 'Return {"molecular": <Molecular AST|null>, "reason": "..."}');
  return lines.join('\n');
}

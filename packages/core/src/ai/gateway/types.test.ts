import { describe, expect, it } from 'vitest';
import { tryParseJson } from './types';

describe('tryParseJson', () => {
  it('parses plain JSON', () => {
    expect(tryParseJson('{"ok":true}')).toEqual({ ok: true });
  });

  it('parses fenced JSON', () => {
    expect(tryParseJson('```json\n{"ok":true}\n```')).toEqual({ ok: true });
  });

  it('recovers JSON after model prose', () => {
    expect(tryParseJson('Here is the JSON:\n{"ok":true}\nDone.')).toEqual({ ok: true });
  });

  it('recovers an array after model prose', () => {
    expect(tryParseJson('Result: [{"id":1},{"id":2}]')).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('preserves braces inside JSON strings', () => {
    expect(tryParseJson('Answer: {"text":"a } b","ok":true}')).toEqual({ text: 'a } b', ok: true });
  });

  it('throws when no complete JSON value exists', () => {
    expect(() => tryParseJson('not json')).toThrow();
    expect(() => tryParseJson('prefix {"ok":')).toThrow();
  });
});

import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getLocalDatabaseClient, resetLocalDatabaseForTests } from './sqlite';

const dbPath = join(tmpdir(), `ai-study-sqlite-test-${process.pid}-${Date.now()}.sqlite`);

function removeDatabaseFiles(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      unlinkSync(dbPath + suffix);
    } catch {
      // 文件不存在则忽略
    }
  }
}

beforeAll(() => {
  process.env.SQLITE_PATH = dbPath;
  resetLocalDatabaseForTests();
});

beforeEach(() => {
  resetLocalDatabaseForTests();
  removeDatabaseFiles();
});

afterAll(() => {
  resetLocalDatabaseForTests();
  removeDatabaseFiles();
});

type Row = Record<string, any>;

function client() {
  return getLocalDatabaseClient();
}

async function expectInsert(table: string, values: Row): Promise<Row> {
  const res = await client().from(table).insert(values);
  expect(res.error).toBeNull();
  const rows = res.data as Row[];
  expect(rows.length).toBeGreaterThan(0);
  return rows[0]!;
}

async function insertQuestion(userId: string, values: Row): Promise<Row> {
  return expectInsert('questions', { user_id: userId, phase: 'high', subject: 'math', content: 'question', ...values });
}

describe('LocalQuery filters', () => {
  it('supports eq/neq/gt/gte/lt/lte', async () => {
    const userId = 'user-compare';
    await insertQuestion(userId, { content: 'q1', created_at: '2026-01-01T00:00:00.000Z' });
    await insertQuestion(userId, { subject: 'physics', content: 'q2', created_at: '2026-02-01T00:00:00.000Z' });
    await insertQuestion(userId, { subject: 'chemistry', content: 'q3', created_at: '2026-03-01T00:00:00.000Z' });

    const subjectsOf = async (query: any) => (await query).data.map((row: Row) => row.subject).sort();

    expect(await subjectsOf(client().from('questions').select('subject').eq('user_id', userId).eq('subject', 'math'))).toEqual(['math']);
    expect(await subjectsOf(client().from('questions').select('subject').eq('user_id', userId).neq('subject', 'math'))).toEqual(['chemistry', 'physics']);
    expect(await subjectsOf(client().from('questions').select('subject').eq('user_id', userId).gt('created_at', '2026-01-15T00:00:00.000Z'))).toEqual(['chemistry', 'physics']);
    expect(await subjectsOf(client().from('questions').select('subject').eq('user_id', userId).gte('created_at', '2026-02-01T00:00:00.000Z'))).toEqual(['chemistry', 'physics']);
    expect(await subjectsOf(client().from('questions').select('subject').eq('user_id', userId).lt('created_at', '2026-02-01T00:00:00.000Z'))).toEqual(['math']);
    expect(await subjectsOf(client().from('questions').select('subject').eq('user_id', userId).lte('created_at', '2026-02-01T00:00:00.000Z'))).toEqual(['math', 'physics']);
  });

  it('supports null filters: eq(col,null), neq(col,null), not(col,is,null)', async () => {
    const userId = 'user-null';
    await insertQuestion(userId, { content: 'no-source' });
    await insertQuestion(userId, { subject: 'physics', content: 'with-source', source: 'demo' });

    const contentsOf = async (query: any) => (await query).data.map((row: Row) => row.content).sort();

    expect(await contentsOf(client().from('questions').select('content').eq('user_id', userId).eq('source', null))).toEqual(['no-source']);
    expect(await contentsOf(client().from('questions').select('content').eq('user_id', userId).neq('source', null))).toEqual(['with-source']);
    expect(await contentsOf(client().from('questions').select('content').eq('user_id', userId).not('source', 'is', null))).toEqual(['with-source']);
  });

  it('supports in() including empty arrays', async () => {
    const userId = 'user-in';
    await insertQuestion(userId, { content: 'q1' });
    await insertQuestion(userId, { subject: 'physics', content: 'q2' });

    const contentsOf = async (query: any) => (await query).data.map((row: Row) => row.content).sort();

    expect(await contentsOf(client().from('questions').select('content').eq('user_id', userId).in('subject', ['math', 'physics']))).toEqual(['q1', 'q2']);
    expect(await contentsOf(client().from('questions').select('content').eq('user_id', userId).in('subject', ['chemistry']))).toEqual([]);
    expect(await contentsOf(client().from('questions').select('content').eq('user_id', userId).in('subject', []))).toEqual([]);
  });

  it('supports or() with nested and() (conversation cursor form)', async () => {
    const conversationId = 'conv-or';
    const userId = 'user-or';
    await expectInsert('conversations', { id: conversationId, user_id: userId, phase: 'high' });
    const messages: Array<[string, string]> = [
      ['m1', '2026-01-01T00:00:00.000Z'],
      ['m2', '2026-01-02T00:00:00.000Z'],
      ['m3', '2026-01-03T00:00:00.000Z'],
    ];
    for (const [id, createdAt] of messages) {
      await expectInsert('conversation_messages', {
        id,
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: `content-${id}`,
        created_at: createdAt,
      });
    }

    const res = await client()
      .from('conversation_messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .or('created_at.gt.2026-01-02T00:00:00.000Z,and(created_at.eq.2026-01-02T00:00:00.000Z,id.gt.m2)');
    expect(res.error).toBeNull();
    expect(res.data.map((row: Row) => row.id)).toEqual(['m3']);
  });
});

describe('LocalQuery ordering and paging', () => {
  it('orders by multiple keys with desc and keeps null values last', async () => {
    const userId = 'user-order';
    await insertQuestion(userId, { content: 'null-source', source: null, created_at: '2026-01-01T00:00:00.000Z' });
    await insertQuestion(userId, { content: 'source-a', source: 'a', created_at: '2026-01-02T00:00:00.000Z' });
    await insertQuestion(userId, { content: 'source-b', source: 'b', created_at: '2026-01-03T00:00:00.000Z' });
    await insertQuestion(userId, { subject: 'art', content: 'art-z', source: 'z', created_at: '2026-01-04T00:00:00.000Z' });

    const multi = await client()
      .from('questions')
      .select('subject, source')
      .eq('user_id', userId)
      .order('subject', { ascending: true })
      .order('source', { ascending: true });
    expect(multi.error).toBeNull();
    expect(multi.data).toEqual([
      { subject: 'art', source: 'z' },
      { subject: 'math', source: 'a' },
      { subject: 'math', source: 'b' },
      { subject: 'math', source: null },
    ]);

    const newestFirst = await client().from('questions').select('content').eq('user_id', userId).order('created_at', { ascending: false });
    expect(newestFirst.data.map((row: Row) => row.content)).toEqual(['art-z', 'source-b', 'source-a', 'null-source']);

    await expectInsert('learning_events', { user_id: userId, phase: 'high', type: 'practice', subject: 'math', score: 90 });
    await expectInsert('learning_events', { user_id: userId, phase: 'high', type: 'practice', subject: 'math', score: 70 });
    await expectInsert('learning_events', { user_id: userId, phase: 'high', type: 'practice', subject: 'math', score: null });

    const descScores = await client().from('learning_events').select('score').eq('user_id', userId).order('score', { ascending: false });
    expect(descScores.data).toEqual([{ score: 90 }, { score: 70 }, { score: null }]);
    const ascScores = await client().from('learning_events').select('score').eq('user_id', userId).order('score', { ascending: true });
    expect(ascScores.data).toEqual([{ score: 70 }, { score: 90 }, { score: null }]);
  });

  it('supports limit and range', async () => {
    const userId = 'user-page';
    for (let i = 1; i <= 5; i += 1) {
      await insertQuestion(userId, { content: `q${i}` });
    }

    const limited = await client().from('questions').select('content').eq('user_id', userId).order('content').limit(2);
    expect(limited.data.map((row: Row) => row.content)).toEqual(['q1', 'q2']);

    const ranged = await client().from('questions').select('content').eq('user_id', userId).order('content').range(1, 3);
    expect(ranged.data.map((row: Row) => row.content)).toEqual(['q2', 'q3', 'q4']);
  });
});

describe('LocalQuery shapes', () => {
  it('supports single/maybeSingle across zero/one/many rows', async () => {
    const userId = 'user-single';
    await insertQuestion(userId, { content: 'only' });

    const one = await client().from('questions').select('content').eq('user_id', userId).single();
    expect(one.error).toBeNull();
    expect(one.data).toEqual({ content: 'only' });

    const maybeOne = await client().from('questions').select('content').eq('user_id', userId).maybeSingle();
    expect(maybeOne.error).toBeNull();
    expect(maybeOne.data).toEqual({ content: 'only' });

    await insertQuestion(userId, { subject: 'physics', content: 'second' });

    const many = await client().from('questions').select('content').eq('user_id', userId).single();
    expect(many.data).toBeNull();
    expect(many.error?.message).toBe('JSON object requested, multiple rows returned');

    const maybeMany = await client().from('questions').select('content').eq('user_id', userId).maybeSingle();
    expect(maybeMany.data).toBeNull();
    expect(maybeMany.error?.message).toBe('JSON object requested, multiple rows returned');

    const none = await client().from('questions').select('content').eq('user_id', 'nobody').single();
    expect(none.data).toBeNull();
    expect(none.error?.message).toBe('JSON object requested, no rows returned');

    const maybeNone = await client().from('questions').select('content').eq('user_id', 'nobody').maybeSingle();
    expect(maybeNone.data).toBeNull();
    expect(maybeNone.error).toBeNull();
  });

  it('returns count with exact and head options', async () => {
    const userId = 'user-count';
    for (let i = 1; i <= 3; i += 1) {
      await insertQuestion(userId, { content: `q${i}` });
    }

    const res = await client().from('questions').select('*', { count: 'exact', head: true }).eq('user_id', userId);
    expect(res.error).toBeNull();
    expect(res.data).toBeNull();
    expect(res.count).toBe(3);
  });
});

describe('LocalQuery mutations', () => {
  it('auto-fills id and created_at on insert', async () => {
    const inserted = await insertQuestion('user-auto', { content: 'auto' });
    expect(typeof inserted.id).toBe('string');
    expect(inserted.id).not.toBe('');
    expect(typeof inserted.created_at).toBe('string');

    const fetched = await client().from('questions').select('id').eq('id', inserted.id);
    expect(fetched.data).toHaveLength(1);
  });

  it('upserts with explicit onConflict and default conflict columns', async () => {
    await client().from('user_memory_facts').upsert({ user_id: 'u1', key: 'goal', value: '985' }, { onConflict: 'user_id,key' });
    await client().from('user_memory_facts').upsert({ user_id: 'u1', key: 'goal', value: '清北' }, { onConflict: 'user_id,key' });
    const facts = await client().from('user_memory_facts').select('value').eq('user_id', 'u1');
    expect(facts.error).toBeNull();
    expect(facts.data).toEqual([{ value: '清北' }]);

    await client().from('knowledge_mastery').upsert({ user_id: 'u1', phase: 'high', knowledge_point: '导数', subject: 'math', level: 0.5 });
    await client().from('knowledge_mastery').upsert({ user_id: 'u1', phase: 'high', knowledge_point: '导数', subject: 'math', level: 0.8 });
    const mastery = await client().from('knowledge_mastery').select('level').eq('user_id', 'u1');
    expect(mastery.error).toBeNull();
    expect(mastery.data).toEqual([{ level: 0.8 }]);
  });

  it('updates and deletes rows matching filters', async () => {
    const userId = 'user-mutation';
    await insertQuestion(userId, { content: 'keep-me' });
    const target = await insertQuestion(userId, { subject: 'physics', content: 'change-me' });

    const updated = await client().from('questions').update({ content: 'changed' }).eq('id', target.id);
    expect(updated.error).toBeNull();
    expect(updated.data).toHaveLength(1);
    expect(updated.data[0].content).toBe('changed');

    const afterUpdate = await client().from('questions').select('content').eq('user_id', userId).order('content');
    expect(afterUpdate.data.map((row: Row) => row.content)).toEqual(['changed', 'keep-me']);

    const deleted = await client().from('questions').delete().eq('id', target.id);
    expect(deleted.error).toBeNull();
    expect(deleted.data).toHaveLength(1);

    const remaining = await client().from('questions').select('content').eq('user_id', userId);
    expect(remaining.data.map((row: Row) => row.content)).toEqual(['keep-me']);
  });
});

describe('LocalQuery projections and encoding', () => {
  it('projects embedded relations for questions and practice_records', async () => {
    const userId = 'user-embed';
    const question = await insertQuestion(userId, { content: 'embedded question' });
    await expectInsert('question_analysis', {
      user_id: userId,
      phase: 'high',
      question_id: question.id,
      subject: 'math',
      question_type: 'choice',
      knowledge_points: ['导数'],
    });
    const wrong = await expectInsert('wrong_questions', {
      user_id: userId,
      phase: 'high',
      question_id: question.id,
      knowledge_points: ['导数'],
    });
    await expectInsert('practice_records', { user_id: userId, phase: 'high', question_id: question.id, is_correct: false, score: 40 });

    const embedded = await client()
      .from('wrong_questions')
      .select('id, questions(subject, content, question_analysis(question_type))')
      .eq('id', wrong.id);
    expect(embedded.error).toBeNull();
    expect(embedded.data).toHaveLength(1);
    expect(embedded.data[0].id).toBe(wrong.id);
    expect(embedded.data[0].questions).toEqual({
      subject: 'math',
      content: 'embedded question',
      question_analysis: [{ question_type: 'choice' }],
    });

    const practices = await client().from('wrong_questions').select('id, practice_records(score)').eq('id', wrong.id);
    expect(practices.error).toBeNull();
    expect(practices.data[0].practice_records).toEqual([{ score: 40 }]);
  });

  it('round-trips JSON columns', async () => {
    const inserted = await expectInsert('learning_events', {
      user_id: 'user-json',
      phase: 'high',
      type: 'practice',
      subject: 'math',
      knowledge_points: ['函数', '导数'],
    });
    expect(inserted.knowledge_points).toEqual(['函数', '导数']);

    const fetched = await client().from('learning_events').select('knowledge_points').eq('user_id', 'user-json');
    expect(fetched.data[0].knowledge_points).toEqual(['函数', '导数']);
  });

  it('matches boolean filters against 0/1 storage (new semantics)', async () => {
    const userId = 'user-bool';
    await expectInsert('study_plans', { user_id: userId, phase: 'high', title: 'active', active: true });
    await expectInsert('study_plans', { user_id: userId, phase: 'high', title: 'inactive', active: false });
    const q1 = await insertQuestion(userId, { content: 'bool-q1' });
    const q2 = await insertQuestion(userId, { content: 'bool-q2' });
    await expectInsert('wrong_questions', { user_id: userId, phase: 'high', question_id: q1.id, mastered: false });
    await expectInsert('wrong_questions', { user_id: userId, phase: 'high', question_id: q2.id, mastered: true });

    const activePlans = await client().from('study_plans').select('title').eq('user_id', userId).eq('active', true);
    expect(activePlans.error).toBeNull();
    expect(activePlans.data).toEqual([{ title: 'active' }]);

    const unmastered = await client().from('wrong_questions').select('question_id').eq('user_id', userId).eq('mastered', false);
    expect(unmastered.error).toBeNull();
    expect(unmastered.data).toEqual([{ question_id: q1.id }]);
  });
});

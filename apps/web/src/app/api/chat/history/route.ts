import {
  appendConversationMessages,
  getAuthUser,
  getOrCreateConversationRow,
  loadConversationMessages,
  listConversations,
} from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const historyMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4000),
  metadata: z
    .object({
      imageUrl: z.string().url().max(2000).optional(),
      action: z.unknown().optional(),
      analyzeResult: z.unknown().optional(),
      replyBlocks: z.unknown().optional(),
    })
    .optional(),
});

const appendHistorySchema = z.object({
  subject: z.string().min(1).max(50),
  conversationId: z.string().uuid().optional(),
  messages: z.array(historyMessageSchema).min(1).max(4),
});

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId');
  const subject = searchParams.get('subject');

  try {
    if (conversationId) {
      const messages = await loadConversationMessages(user.id, conversationId, 50);
      return NextResponse.json({ conversationId, messages });
    }

    if (subject) {
      const conversations = await listConversations(user.id, subject, 10);
      if (conversations.length === 0) {
        // 冷启动：真实创建一个会话，返回其真实 id/title/updatedAt（不再伪造时间戳）。
        const row = await getOrCreateConversationRow(user.id, subject);
        return NextResponse.json({
          conversations: [{ id: row.id, title: row.title, updatedAt: row.updatedAt }],
        });
      }
      return NextResponse.json({ conversations });
    }

    const conversations = await listConversations(user.id, undefined, 20);
    return NextResponse.json({ conversations });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = appendHistorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const conversationId = await appendConversationMessages(
      user.id,
      parsed.data.subject,
      parsed.data.messages,
      parsed.data.conversationId,
    );
    return NextResponse.json({ conversationId });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

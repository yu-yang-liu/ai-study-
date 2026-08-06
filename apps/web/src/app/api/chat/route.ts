import {
  getAuthUser,
  checkAIRateLimit,
  loadMemory,
  appendTurn,
  runChatAgent,
  AIStructuredError,
} from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const chatSchema = z.object({
  subject: z.string().min(1),
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await checkAIRateLimit(user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: '\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { subject, message, conversationId: inputConversationId } = parsed.data;

  try {
    const mem = await loadMemory({
      userId: user.id,
      subject,
      conversationId: inputConversationId,
      query: message,
    });

    const agentResult = await runChatAgent({
      userId: user.id,
      subject,
      message,
      history: mem.shortTerm,
      assistantContext: mem.longTerm,
    });

    let savedConversationId = mem.conversationId;
    try {
      savedConversationId = await appendTurn(
        { userId: user.id, subject, conversationId: mem.conversationId },
        { userMessage: message, assistantReply: agentResult.reply },
        mem.conversationId,
      );
    } catch (persistErr) {
      console.warn('chat persist failed:', persistErr);
    }

    return NextResponse.json({
      reply: agentResult.reply,
      conversationId: savedConversationId,
      action: agentResult.action,
    });
  } catch (err) {
    if (err instanceof AIStructuredError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

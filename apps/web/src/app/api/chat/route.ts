import {
  getAuthUser,
  checkAIRateLimit,
  getAssistantContext,
  getOrCreateConversation,
  loadConversationMessages,
  runChatAgent,
  persistChatExchange,
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

  const body = await request.json();
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { subject, message, conversationId: inputConversationId } = parsed.data;

  try {
    const conversationId = await getOrCreateConversation(user.id, subject, inputConversationId);
    const [history, { assistantText }] = await Promise.all([
      loadConversationMessages(user.id, conversationId, 20),
      getAssistantContext(user.id),
    ]);

    const agentResult = await runChatAgent({
      userId: user.id,
      subject,
      message,
      history,
      assistantContext: assistantText,
    });

    let savedConversationId = conversationId;
    try {
      savedConversationId = await persistChatExchange(
        user.id,
        subject,
        message,
        agentResult.reply,
        conversationId,
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

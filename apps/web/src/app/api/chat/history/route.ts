import {
  getAuthUser,
  getOrCreateConversation,
  loadConversationMessages,
  listConversations,
} from '@ai-study/core';
import { NextResponse } from 'next/server';

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
        const newId = await getOrCreateConversation(user.id, subject);
        return NextResponse.json({ conversations: [{ id: newId, title: subject, updatedAt: new Date().toISOString() }] });
      }
      return NextResponse.json({ conversations });
    }

    const conversations = await listConversations(user.id, undefined, 20);
    return NextResponse.json({ conversations });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

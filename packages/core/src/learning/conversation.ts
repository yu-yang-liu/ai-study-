import { createServiceClient } from '../db';
import { APP_PHASE } from '../constants';

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export async function getOrCreateConversation(
  userId: string,
  subject: string,
  conversationId?: string,
): Promise<string> {
  const supabase = createServiceClient();

  if (conversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('phase', APP_PHASE)
    .eq('title', subject)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, phase: APP_PHASE, title: subject })
    .select('id')
    .single();

  if (error || !created) throw new Error(`getOrCreateConversation: ${error?.message ?? 'no row'}`);
  return created.id as string;
}

export async function loadConversationMessages(
  userId: string,
  conversationId: string,
  limit = 20,
): Promise<ConversationMessage[]> {
  const supabase = createServiceClient();

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!conv) return [];

  const { data, error } = await supabase
    .from('conversation_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`loadConversationMessages: ${error.message}`);

  return (data ?? [])
    .reverse()
    .map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
      createdAt: row.created_at as string,
    }));
}

export async function listConversations(
  userId: string,
  subject?: string,
  limit = 10,
): Promise<ConversationSummary[]> {
  const supabase = createServiceClient();
  let query = supabase
    .from('conversations')
    .select('id, title, updated_at')
    .eq('user_id', userId)
    .eq('phase', APP_PHASE)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (subject) query = query.eq('title', subject);

  const { data, error } = await query;
  if (error) throw new Error(`listConversations: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    updatedAt: row.updated_at as string,
  }));
}

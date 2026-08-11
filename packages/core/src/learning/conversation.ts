import { getServiceClient } from '../db';
import { APP_PHASE } from '../constants';

export interface ConversationMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  imageUrl?: string;
  action?: unknown;
  analyzeResult?: unknown;
  replyBlocks?: unknown;
}

export interface ConversationMessageMetadata {
  imageUrl?: string;
  action?: unknown;
  analyzeResult?: unknown;
  replyBlocks?: unknown;
}

export interface ConversationMessageInput {
  role: 'user' | 'assistant';
  content: string;
  metadata?: ConversationMessageMetadata;
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
  const row = await getOrCreateConversationRow(userId, subject, conversationId);
  return row.id;
}

/**
 * 同 getOrCreateConversation，但返回完整行（含 created_at/updated_at/title）。
 * 供需要真实时间戳的调用方（如 chat/history 冷启动展示）使用，避免伪造时间戳。
 */
export async function getOrCreateConversationRow(
  userId: string,
  subject: string,
  conversationId?: string,
): Promise<{ id: string; title: string; createdAt: string; updatedAt: string }> {
  const supabase = getServiceClient();

  if (conversationId) {
    const { data } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data) {
      return {
        id: data.id as string,
        title: data.title as string,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
      };
    }
  }

  const { data: existing } = await supabase
    .from('conversations')
    .select('id, title, created_at, updated_at')
    .eq('user_id', userId)
    .eq('phase', APP_PHASE)
    .eq('title', subject)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      title: existing.title as string,
      createdAt: existing.created_at as string,
      updatedAt: existing.updated_at as string,
    };
  }

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ user_id: userId, phase: APP_PHASE, title: subject })
    .select('id, title, created_at, updated_at')
    .single();

  if (error || !created) throw new Error(`getOrCreateConversation: ${error?.message ?? 'no row'}`);
  return {
    id: created.id as string,
    title: created.title as string,
    createdAt: created.created_at as string,
    updatedAt: created.updated_at as string,
  };
}

export async function loadConversationMessages(
  userId: string,
  conversationId: string,
  limit = 20,
): Promise<ConversationMessage[]> {
  const supabase = getServiceClient();

  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!conv) return [];

  const { data, error } = await supabase
    .from('conversation_messages')
    .select('id, role, content, metadata, created_at')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`loadConversationMessages: ${error.message}`);

  return (data ?? [])
    .reverse()
    .map((row) => ({
      id: row.id as string,
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
      createdAt: row.created_at as string,
      imageUrl: (row.metadata as ConversationMessageMetadata | null)?.imageUrl,
      action: (row.metadata as ConversationMessageMetadata | null)?.action,
      analyzeResult: (row.metadata as ConversationMessageMetadata | null)?.analyzeResult,
      replyBlocks: (row.metadata as ConversationMessageMetadata | null)?.replyBlocks,
    }));
}

/**
 * Append rich messages to a conversation without coupling the chat agent to
 * image-analysis payloads. Existing text-only messages use an empty metadata
 * object and remain fully compatible.
 */
export async function appendConversationMessages(
  userId: string,
  subject: string,
  messages: ConversationMessageInput[],
  conversationId?: string,
): Promise<string> {
  if (messages.length === 0) throw new Error('appendConversationMessages: no messages');

  const supabase = getServiceClient();
  const resolvedConversationId = await getOrCreateConversation(userId, subject, conversationId);

  const { error: messageError } = await supabase.from('conversation_messages').insert(
    messages.map((message) => ({
      user_id: userId,
      conversation_id: resolvedConversationId,
      role: message.role,
      content: message.content,
      metadata: message.metadata ?? {},
    })),
  );
  if (messageError) throw new Error(`appendConversationMessages: ${messageError.message}`);

  const { error: conversationError } = await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', resolvedConversationId)
    .eq('user_id', userId);
  if (conversationError) throw new Error(`appendConversationMessages update: ${conversationError.message}`);

  return resolvedConversationId;
}

export async function listConversations(
  userId: string,
  subject?: string,
  limit = 10,
): Promise<ConversationSummary[]> {
  const supabase = getServiceClient();
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

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Card, SubjectPicker, ChatBubble, LayoutShell, PageTitle } from '@ai-study/core/ui';

type ChatAction = {
  type: 'plan' | 'analyze' | 'grade' | 'wrong_questions';
  payload: Record<string, unknown>;
};

type Message = {
  role: 'user' | 'ai';
  content: string;
  action?: ChatAction;
};

const QUICK_CHIPS = [
  '帮我制定今日学习计划',
  '我的薄弱点在哪里',
  '我有哪些待复习错题',
];

function ActionCard({ action }: { action: ChatAction }) {
  if (action.type === 'plan') {
    const title = String(action.payload.title ?? '');
    const tasks = (action.payload.tasks as Array<{ title: string; subject: string; estimatedMinutes: number }>) ?? [];
    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p className="font-medium text-emerald-900">{'学习计划：'}{title}</p>
        <ul className="mt-2 list-inside list-disc text-emerald-800">
          {tasks.slice(0, 5).map((t, i) => (
            <li key={i}>{t.title} ({t.subject}, {t.estimatedMinutes}{'分钟'})</li>
          ))}
        </ul>
      </div>
    );
  }

  if (action.type === 'grade') {
    const score = action.payload.score as number;
    const maxScore = action.payload.maxScore as number;
    const summary = String(action.payload.summary ?? '');
    return (
      <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
        <p className="font-medium text-blue-900">{'批改结果：'}{score}/{maxScore}</p>
        <p className="mt-1 text-blue-800">{summary}</p>
      </div>
    );
  }

  if (action.type === 'analyze') {
    const analysis = String(action.payload.analysis ?? '');
    return (
      <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
        <p className="font-medium text-violet-900">{'题目分析'}</p>
        <p className="mt-1 text-violet-800">{analysis.slice(0, 200)}{analysis.length > 200 ? '...' : ''}</p>
      </div>
    );
  }

  if (action.type === 'wrong_questions') {
    const total = action.payload.total as number;
    const items = (action.payload.items as Array<{ subject: string; preview: string }>) ?? [];
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="font-medium text-amber-900">{'错题摘要：共 '}{total}{'题'}</p>
        <ul className="mt-2 list-inside list-disc text-amber-800">
          {items.map((item, i) => (
            <li key={i}>[{item.subject}] {item.preview}</li>
          ))}
        </ul>
      </div>
    );
  }

  return null;
}

export default function ChatPage() {
  const [subject, setSubject] = useState('数学');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadHistory = useCallback(async (subj: string, convId?: string | null) => {
    setHistoryLoading(true);
    try {
      const params = convId
        ? `conversationId=${encodeURIComponent(convId)}`
        : `subject=${encodeURIComponent(subj)}`;
      const res = await fetch(`/api/chat/history?${params}`);
      if (!res.ok) {
        setMessages([]);
        return;
      }
      const data = await res.json();
      if (data.conversationId) {
        setConversationId(data.conversationId);
        setMessages(
          (data.messages ?? []).map((m: { role: string; content: string }) => ({
            role: m.role === 'user' ? 'user' : 'ai',
            content: m.content,
          })),
        );
      } else if (data.conversations?.[0]?.id) {
        const id = data.conversations[0].id as string;
        setConversationId(id);
        const histRes = await fetch(`/api/chat/history?conversationId=${encodeURIComponent(id)}`);
        if (histRes.ok) {
          const histData = await histRes.json();
          setMessages(
            (histData.messages ?? []).map((m: { role: string; content: string }) => ({
              role: m.role === 'user' ? 'user' : 'ai',
              content: m.content,
            })),
          );
        }
      }
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    setConversationId(null);
    void loadHistory(subject, null);
  }, [subject, loadHistory]);

  async function send(textOverride?: string) {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message: text,
          ...(conversationId ? { conversationId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = typeof data.error === 'string' ? data.error : '请求失败';
        setMessages((prev) => [...prev, { role: 'ai', content: errMsg }]);
        return;
      }
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: data.reply ?? 'AI 无响应',
          action: data.action,
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', content: '网络错误，请重试' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LayoutShell title={'AI高中'}>
      <PageTitle title={'AI 学习助手'} />
      <Card className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: 400 }}>
        <div className="mb-4">
          <SubjectPicker value={subject} onChange={setSubject} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {historyLoading && (
            <p className="mt-8 text-center text-xs text-slate-400">{'加载历史对话...'}</p>
          )}
          {!historyLoading && messages.length === 0 && (
            <div className="mt-12 text-center">
              <p className="text-slate-400">{'选择学科，开始与 AI 学习助手对话'}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {QUICK_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => void send(chip)}
                    disabled={loading}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-slate-400 hover:text-slate-900"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i}>
              <ChatBubble role={m.role} content={m.content} />
              {m.action && m.role === 'ai' && <ActionCard action={m.action} />}
            </div>
          ))}
          {loading && <p className="text-center text-xs text-slate-400">{'AI 思考中...'}</p>}
          <div ref={endRef} />
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={'输入问题，按 Enter 发送...'}
            disabled={loading}
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
          />
          <Button onClick={() => void send()} loading={loading} disabled={!input.trim()}>
            {'发送'}
          </Button>
        </div>
      </Card>
    </LayoutShell>
  );
}

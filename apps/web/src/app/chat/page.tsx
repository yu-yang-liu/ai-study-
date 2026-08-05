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
  '\u5e2e\u6211\u5236\u5b9a\u4eca\u65e5\u5b66\u4e60\u8ba1\u5212',
  '\u6211\u7684\u8584\u5f31\u70b9\u5728\u54ea\u91cc',
  '\u6211\u6709\u54ea\u4e9b\u5f85\u590d\u4e60\u9519\u9898',
];

function ActionCard({ action }: { action: ChatAction }) {
  if (action.type === 'plan') {
    const title = String(action.payload.title ?? '');
    const tasks = (action.payload.tasks as Array<{ title: string; subject: string; estimatedMinutes: number }>) ?? [];
    return (
      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
        <p className="font-medium text-emerald-900">{'\u5b66\u4e60\u8ba1\u5212\uff1a'}{title}</p>
        <ul className="mt-2 list-inside list-disc text-emerald-800">
          {tasks.slice(0, 5).map((t, i) => (
            <li key={i}>{t.title} ({t.subject}, {t.estimatedMinutes}{'\u5206\u949f'})</li>
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
        <p className="font-medium text-blue-900">{'\u6279\u6539\u7ed3\u679c\uff1a'}{score}/{maxScore}</p>
        <p className="mt-1 text-blue-800">{summary}</p>
      </div>
    );
  }

  if (action.type === 'analyze') {
    const analysis = String(action.payload.analysis ?? '');
    return (
      <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm">
        <p className="font-medium text-violet-900">{'\u9898\u76ee\u5206\u6790'}</p>
        <p className="mt-1 text-violet-800">{analysis.slice(0, 200)}{analysis.length > 200 ? '...' : ''}</p>
      </div>
    );
  }

  if (action.type === 'wrong_questions') {
    const total = action.payload.total as number;
    const items = (action.payload.items as Array<{ subject: string; preview: string }>) ?? [];
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
        <p className="font-medium text-amber-900">{'\u9519\u9898\u6458\u8981\uff1a\u5171 '}{total}{'\u9898'}</p>
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
  const [subject, setSubject] = useState('\u6570\u5b66');
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
        const errMsg = typeof data.error === 'string' ? data.error : '\u8bf7\u6c42\u5931\u8d25';
        setMessages((prev) => [...prev, { role: 'ai', content: errMsg }]);
        return;
      }
      if (data.conversationId) setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: data.reply ?? '\u0041\u0049 \u65e0\u54cd\u5e94',
          action: data.action,
        },
      ]);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', content: '\u7f51\u7edc\u9519\u8bef\uff0c\u8bf7\u91cd\u8bd5' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LayoutShell title={'\u0041\u0049\u9ad8\u4e2d'}>
      <PageTitle title={'AI \u5b66\u4e60\u52a9\u624b'} />
      <Card className="flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: 400 }}>
        <div className="mb-4">
          <SubjectPicker value={subject} onChange={setSubject} />
        </div>
        <div className="flex-1 overflow-y-auto">
          {historyLoading && (
            <p className="mt-8 text-center text-xs text-slate-400">{'\u52a0\u8f7d\u5386\u53f2\u5bf9\u8bdd...'}</p>
          )}
          {!historyLoading && messages.length === 0 && (
            <div className="mt-12 text-center">
              <p className="text-slate-400">{'\u9009\u62e9\u5b66\u79d1\uff0c\u5f00\u59cb\u4e0e AI \u5b66\u4e60\u52a9\u624b\u5bf9\u8bdd'}</p>
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
          {loading && <p className="text-center text-xs text-slate-400">{'AI \u601d\u8003\u4e2d...'}</p>}
          <div ref={endRef} />
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={'\u8f93\u5165\u95ee\u9898\uff0c\u6309 Enter \u53d1\u9001...'}
            disabled={loading}
            className="flex-1 rounded-lg border border-neutral-200 px-3 py-2.5 text-sm placeholder:text-slate-400 focus:border-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-none"
          />
          <Button onClick={() => void send()} loading={loading} disabled={!input.trim()}>
            {'\u53d1\u9001'}
          </Button>
        </div>
      </Card>
    </LayoutShell>
  );
}

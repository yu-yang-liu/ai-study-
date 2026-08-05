'use client';

import { useState } from 'react';
import { Button, Card, Input, SubjectPicker, ErrorBanner, PriorityBadge, LayoutShell, PageTitle } from '@ai-study/core/ui';

export default function PlanPage() {
  const [subject, setSubject] = useState('数学');
  const [focus, setFocus] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, focus: focus || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? '请求失败'); return; }
      setResult(data);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LayoutShell title="高考 AI">
      <PageTitle title="学习计划" />
      <form onSubmit={handleSubmit}>
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SubjectPicker value={subject} onChange={setSubject} />
            <Input
              label="重点关注（可选）"
              value={focus}
              onChange={(e) => setFocus((e.target as HTMLInputElement).value)}
              placeholder="例如：导数、文言文..."
            />
          </div>
          <Button type="submit" loading={loading}>
            生成学习计划
          </Button>
        </Card>
      </form>

      {error && <div className="mt-4"><ErrorBanner message={error} onDismiss={() => setError('')} /></div>}

      {result && (
        <Card className="mt-6">
          <h3 className="mb-2 text-lg font-semibold text-slate-900">{String(result.title ?? '学习计划')}</h3>
          <p className="mb-5 text-sm text-neutral-500">{String(result.description ?? '')}</p>
          {Array.isArray(result.tasks) && (
            <div className="space-y-3">
              {(result.tasks as Record<string, unknown>[]).map((t, i) => (
                <div key={i} className="rounded-lg border-l-3 border-l-slate-900 bg-neutral-50 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{String(t.title ?? '')}</span>
                    <PriorityBadge priority={String(t.priority ?? '')} />
                  </div>
                  <p className="text-xs text-neutral-500">
                    {String(t.subject ?? '')} · {String(t.estimatedMinutes ?? 0)}分钟 · {Array.isArray(t.knowledgePoints) ? (t.knowledgePoints as string[]).join('、') : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{String(t.reason ?? '')}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </LayoutShell>
  );
}

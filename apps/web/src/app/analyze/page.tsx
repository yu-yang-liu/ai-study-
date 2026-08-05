'use client';

import { useState } from 'react';
import { Button, Card, Textarea, SubjectPicker, ErrorBanner, LayoutShell, PageTitle } from '@ai-study/core/ui';

export default function AnalyzePage() {
  const [subject, setSubject] = useState('数学');
  const [content, setContent] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (content.length < 10) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, content }),
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
      <PageTitle title="试题分析" />
      <form onSubmit={handleSubmit}>
        <Card className="space-y-4">
          <SubjectPicker value={subject} onChange={setSubject} />
          <Textarea
            label="题目内容"
            value={content}
            onChange={(e) => setContent((e.target as HTMLTextAreaElement).value)}
            rows={5}
            placeholder="请粘贴题目文字内容（至少10字）..."
          />
          <Button type="submit" loading={loading} disabled={content.length < 10}>
            开始分�?
          </Button>
        </Card>
      </form>

      {error && <div className="mt-4"><ErrorBanner message={error} onDismiss={() => setError('')} /></div>}

      {result && (
        <Card className="mt-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">分析结果</h3>
          <div className="space-y-3">
            {Object.entries(result).map(([key, val]) => (
              <div key={key} className="flex gap-3">
                <span className="min-w-20 text-xs text-slate-400">{key}</span>
                <span className="text-sm font-medium text-slate-700">
                  {Array.isArray(val) ? val.join('、') : String(val)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </LayoutShell>
  );
}

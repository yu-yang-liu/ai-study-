'use client';

import { useState } from 'react';
import { Button, Card, Textarea, SubjectPicker, ErrorBanner, LayoutShell, PageTitle, PriorityBadge } from '@ai-study/core/ui';

export default function GradePage() {
  const [subject, setSubject] = useState('数学');
  const [questionType, setQuestionType] = useState<'math' | 'essay'>('math');
  const [questionContent, setQuestionContent] = useState('');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (questionContent.length < 10 || !studentAnswer) return;
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, questionType, questionContent, studentAnswer }),
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
      <PageTitle title="智能批改" />
      <form onSubmit={handleSubmit}>
        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <SubjectPicker value={subject} onChange={setSubject} />
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">题型</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType((e.target as HTMLSelectElement).value as 'math' | 'essay')}
                className="w-full rounded-lg border border-neutral-200 px-3 py-2.5 text-sm"
              >
                <option value="math">数学/理科大题</option>
                <option value="essay">作文/文科大题</option>
              </select>
            </div>
          </div>
          <Textarea
            label="题目内容"
            value={questionContent}
            onChange={(e) => setQuestionContent((e.target as HTMLTextAreaElement).value)}
            rows={3}
            placeholder="输入原题..."
          />
          <Textarea
            label="学生作答"
            value={studentAnswer}
            onChange={(e) => setStudentAnswer((e.target as HTMLTextAreaElement).value)}
            rows={5}
            placeholder="粘贴学生的解答过程..."
          />
          <Button type="submit" loading={loading} disabled={questionContent.length < 10 || !studentAnswer}>
            提交批改
          </Button>
        </Card>
      </form>

      {error && <div className="mt-4"><ErrorBanner message={error} onDismiss={() => setError('')} /></div>}

      {result && (
        <Card className="mt-6">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            批改结果
            {typeof result.score === 'number' && (
              <span className={`ml-3 ${(result.score >= ((result.maxScore as number) ?? 60) * 0.8) ? 'text-emerald-800' : 'text-red-800'}`}>
                {String(result.score)}/{String(result.maxScore ?? 100)}
              </span>
            )}
          </h3>
          {Array.isArray(result.steps) && (
            <div className="mb-3 space-y-0">
              {(result.steps as Record<string, unknown>[]).map((s, i) => (
                <div key={i} className="flex items-start gap-3 border-b border-slate-100 py-2">
                  <span className={`min-w-12 text-sm font-semibold ${s.isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>
                    步骤{String(s.stepNumber)}
                  </span>
                  <span className="text-sm text-slate-600">{String(s.feedback ?? '')}</span>
                </div>
              ))}
            </div>
          )}
          {Boolean(result.summary) && <p className="text-sm leading-relaxed text-slate-600">{String(result.summary)}</p>}
        </Card>
      )}
    </LayoutShell>
  );
}

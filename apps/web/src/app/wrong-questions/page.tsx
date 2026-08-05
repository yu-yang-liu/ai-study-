'use client';

import { useState, useEffect } from 'react';
import { Card, LayoutShell, PageTitle, Spinner, ErrorBanner } from '@ai-study/core/ui';

interface WrongQuestion {
  id: string;
  questionContent: string;
  studentAnswer: string;
  correctAnswer: string;
  subject: string;
  knowledgePoint: string;
  createdAt: string;
  nextReviewAt: string;
  sm2_interval: number;
  sm2_ease: number;
}

export default function WrongQuestionsPage() {
  const [questions, setQuestions] = useState<WrongQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch('/api/wrong-questions');
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? '加载失败'); return; }
        setQuestions(data.questions ?? []);
      } catch {
        setError('网络错误');
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, []);

  async function reviewQuestion(id: string, quality: number) {
    try {
      const res = await fetch('/api/wrong-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quality }),
      });
      if (res.ok) {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
      }
    } catch {
      setError('操作失败');
    }
  }

  const dueQuestions = questions.filter(
    (q) => !q.nextReviewAt || new Date(q.nextReviewAt) <= new Date(),
  );
  const upcomingQuestions = questions.filter(
    (q) => q.nextReviewAt && new Date(q.nextReviewAt) > new Date(),
  );

  return (
    <LayoutShell title={'\u0041\u0049\u9ad8\u4e2d'}>
      <PageTitle title="错题复习" subtitle={`${dueQuestions.length} 道待复习 · 共 ${questions.length} 道错题`} />
      {error && <div className="mb-4"><ErrorBanner message={error} onDismiss={() => setError('')} /></div>}
      {loading ? (
        <Spinner />
      ) : questions.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-slate-400">暂无错题记录。完成批改后，错题会自动汇集到这里。</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {dueQuestions.map((q) => (
            <Card key={q.id}>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700">{q.subject}</span>
                <span className="text-xs text-slate-400">{q.knowledgePoint}</span>
                <span className="ml-auto text-xs text-slate-400">第 {q.sm2_interval} 次复习</span>
              </div>
              <div className="mb-3 border-l-4 border-slate-200 py-1 pl-3">
                <p className="text-sm text-slate-700">{q.questionContent}</p>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded bg-red-50 p-2">
                  <span className="text-xs text-red-300">你的作答</span>
                  <p className="text-red-800">{q.studentAnswer}</p>
                </div>
                <div className="rounded bg-green-50 p-2">
                  <span className="text-xs text-green-300">正确答案</span>
                  <p className="text-green-800">{q.correctAnswer}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { label: '完全忘了', quality: 0, variant: 'danger' as const },
                  { label: '有点印象', quality: 2, variant: 'secondary' as const },
                  { label: '基本掌握', quality: 3, variant: 'secondary' as const },
                  { label: '完全掌握', quality: 5, variant: 'primary' as const },
                ].map((act) => (
                  <button
                    key={act.quality}
                    onClick={() => reviewQuestion(q.id, act.quality)}
                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      act.variant === 'danger'
                        ? 'bg-red-100 text-red-800 hover:bg-red-200'
                        : act.variant === 'primary'
                          ? 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            </Card>
          ))}
          {upcomingQuestions.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold text-neutral-500">计划中 ({upcomingQuestions.length} 道)</h3>
              <div className="space-y-2">
                {upcomingQuestions.slice(0, 5).map((q) => (
                  <div key={q.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-4 py-2 text-sm">
                    <span className="text-slate-600">{q.subject} · {q.knowledgePoint}</span>
                    <span className="text-xs text-slate-400">
                      {q.nextReviewAt ? new Date(q.nextReviewAt).toLocaleDateString('zh-CN') : '待排期'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </LayoutShell>
  );
}

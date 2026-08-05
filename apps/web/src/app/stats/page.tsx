'use client';

import { useState, useEffect } from 'react';
import { Card, LayoutShell, PageTitle, Spinner, ErrorBanner } from '@ai-study/core/ui';

const SUBJECTS = ['语文', '数学', '英语', '物理', '化学', '生物', '政治', '历史', '地理'];

interface StatsData {
  totalQuestions: number;
  totalWrong: number;
  accuracy: number;
  avgScore: number;
  subjectBreakdown: Record<string, { correct: number; wrong: number; avgScore: number }>;
  recentActivity: Array<{ date: string; count: number }>;
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? '加载失败'); return; }
        setStats(data);
      } catch {
        setError('网络错误');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) return <LayoutShell title="高考 AI"><PageTitle title="学习统计" /><Spinner /></LayoutShell>;
  if (error) return <LayoutShell title="高考 AI"><PageTitle title="学习统计" /><ErrorBanner message={error} /></LayoutShell>;
  if (!stats) return <LayoutShell title="高考 AI"><PageTitle title="学习统计" /><Card className="py-12 text-center"><p className="text-slate-400">暂无数据</p></Card></LayoutShell>;

  const accuracy = stats.accuracy ?? 0;

  return (
    <LayoutShell title="高考 AI">
      <PageTitle title="学习统计" subtitle="你的学习数据总览" />
      <div className="mb-6 grid grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-3xl font-bold text-slate-900">{stats.totalQuestions}</p>
          <p className="mt-1 text-xs text-slate-400">总练习量</p>
        </Card>
        <Card className="text-center">
          <p className={`text-3xl font-bold text-slate-900`}>
            {accuracy}%
          </p>
          <p className="mt-1 text-xs text-slate-400">正确率</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-slate-900">{stats.avgScore}</p>
          <p className="mt-1 text-xs text-slate-400">均分</p>
        </Card>
      </div>

      <h3 className="mb-3 text-sm font-semibold text-neutral-500">各科表现</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SUBJECTS.map((subj) => {
          const data = stats.subjectBreakdown[subj];
          if (!data) return null;
          const subjAccuracy = data.correct + data.wrong > 0
            ? Math.round((data.correct / (data.correct + data.wrong)) * 100)
            : 0;
          return (
            <div key={subj} className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
              <span className="min-w-10 text-sm font-medium text-slate-700">{subj}</span>
              <div className="flex-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full transition-all bg-slate-900`}
                    style={{ width: `${subjAccuracy}%` }}
                  />
                </div>
              </div>
              <span className="min-w-10 text-right text-xs text-slate-400">{subjAccuracy}%</span>
            </div>
          );
        })}
      </div>

      {stats.recentActivity.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-neutral-500">最近学习</h3>
          <Card>
            <div className="space-y-2">
              {stats.recentActivity.slice(0, 7).map((day) => (
                <div key={day.date} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{day.date}</span>
                  <span className="font-medium text-slate-700">{day.count} 次</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </LayoutShell>
  );
}

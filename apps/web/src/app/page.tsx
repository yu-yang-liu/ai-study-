'use client';

import { useState, useEffect } from 'react';
import { Card, LayoutShell, Spinner } from '@ai-study/core/ui';
import Link from 'next/link';

const FEATURES = [
  { title: 'AI \u5b66\u4e60\u52a9\u624b', desc: '\u61c2\u4f60\u7684\u5b66\u60c5\uff0c\u53ef\u5236\u5b9a\u8ba1\u5212\u3001\u67e5\u9519\u9898\u3001\u6279\u6539\u4f5c\u4e1a', href: '/chat', color: 'border-l-emerald-600' },
  { title: '\u62cd\u7167\u4e0a\u4f20', desc: '\u4e0a\u4f20\u9898\u76ee\u56fe\u7247\uff0cAI \u8bc6\u522b\u5e76\u5206\u6790', href: '/upload', color: 'border-l-slate-900' },
  { title: '\u8bd5\u9898\u5206\u6790', desc: '\u8f93\u5165\u9898\u76ee\u6587\u672c\uff0cAI \u5224\u65ad\u5b66\u79d1\u3001\u77e5\u8bc6\u70b9\u3001\u96be\u5ea6\u5e76\u7ed9\u51fa\u89e3\u6790', href: '/analyze', color: 'border-l-slate-900' },
  { title: '\u667a\u80fd\u6279\u6539', desc: '\u4e0a\u4f20\u89e3\u9898\u8fc7\u7a0b\uff0cAI \u6309\u6b65\u9aa4\u6279\u6539\u5e76\u7ed9\u51fa\u9488\u5bf9\u6027\u53cd\u9988', href: '/grade', color: 'border-l-slate-900' },
  { title: '\u5b66\u4e60\u8ba1\u5212', desc: '\u57fa\u4e8e\u5b66\u60c5\u5206\u6790\u751f\u6210\u4e2a\u6027\u5316\u5907\u8003\u8ba1\u5212', href: '/plan', color: 'border-l-slate-900' },
  { title: '\u9519\u9898\u590d\u4e60', desc: '\u667a\u80fd\u590d\u4e60\u9519\u9898\uff0c\u57fa\u4e8e\u9057\u5fd8\u66f2\u7ebf\u5b89\u6392\u6700\u4f73\u590d\u4e60\u65f6\u673a', href: '/wrong-questions', color: 'border-l-slate-900' },
  { title: '\u5b66\u4e60\u7edf\u8ba1', desc: '\u67e5\u770b\u5b66\u4e60\u65f6\u957f\u3001\u638c\u63e1\u5ea6\u53d8\u5316\u3001\u79d1\u76ee\u5206\u5e03', href: '/stats', color: 'border-l-slate-900' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<{ questions: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/bank/count')
      .then((r) => r.json())
      .then((data) => setStats({ questions: typeof data.count === 'number' ? data.count : 0 }))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <LayoutShell title="AI\u9ad8\u4e2d">
      <PageTitle title="AI\u9ad8\u4e2d\u5b66\u4e60\u7cfb\u7edf" subtitle="AI\u9a71\u52a8\u7684\u4e2a\u6027\u5316\u5907\u8003\u52a9\u624b" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <Link key={f.href} href={f.href} className="no-underline">
            <Card className={`cursor-pointer border-l-4 transition-shadow hover:shadow-md ${f.color}`}>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-500">{f.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
      {loading && <Spinner />}
      {stats && !loading && (
        <Card className="mt-6 text-center">
          <p className="text-sm text-neutral-500">
            {'\u9898\u5e93\u5df2\u6536\u5f55 '}
            <strong className="text-slate-900">{stats.questions}</strong>
            {' \u9053\u771f\u9898'}
          </p>
        </Card>
      )}
    </LayoutShell>
  );
}

function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
    </div>
  );
}

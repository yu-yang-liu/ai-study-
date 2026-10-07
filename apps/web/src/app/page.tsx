'use client';

import { useState, useEffect } from 'react';
import { Card, LayoutShell, Spinner } from '@ai-study/core/ui';
import Link from 'next/link';

const FEATURES = [
  { title: 'AI 学习助手', desc: '懂你的学情，可制定计划、查错题、批改作业', href: '/chat', color: 'border-l-emerald-600' },
  { title: '拍照上传', desc: '上传题目图片，AI 识别并分析', href: '/upload', color: 'border-l-slate-900' },
  { title: '试题分析', desc: '输入题目文本，AI 判断学科、知识点、难度并给出解析', href: '/analyze', color: 'border-l-slate-900' },
  { title: '智能批改', desc: '上传解题过程，AI 按步骤批改并给出针对性反馈', href: '/grade', color: 'border-l-slate-900' },
  { title: '学习计划', desc: '基于学情分析生成个性化备考计划', href: '/plan', color: 'border-l-slate-900' },
  { title: '错题复习', desc: '智能复习错题，基于遗忘曲线安排最佳复习时机', href: '/wrong-questions', color: 'border-l-slate-900' },
  { title: '学习统计', desc: '查看学习时长、掌握度变化、科目分布', href: '/stats', color: 'border-l-slate-900' },
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
    <LayoutShell title="AI高中">
      <PageTitle title="AI高中学习系统" subtitle="AI驱动的个性化备考助手" />
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
            {'题库已收录 '}
            <strong className="text-slate-900">{stats.questions}</strong>
            {' 道真题'}
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

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface NavProps {
  title: string;
  navItems?: Array<{ href: string; label: string }>;
}

const DEFAULT_ITEMS = [
  { href: '/', label: '首页' },
  { href: '/analyze', label: '试题分析' },
  { href: '/upload', label: '拍照上传' },
  { href: '/grade', label: '智能批改' },
  { href: '/chat', label: 'AI 学习助手' },
  { href: '/plan', label: '学习计划' },
  { href: '/wrong-questions', label: '错题复习' },
  { href: '/stats', label: '学习统计' },
];

export function Nav({ title, navItems = DEFAULT_ITEMS }: NavProps) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === '/login') return null;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <nav className="flex h-12 items-center gap-6 bg-slate-900 px-6">
      <span className="mr-4 text-lg font-bold text-white">{title}</span>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`text-sm no-underline transition-colors ${
            pathname === item.href ? 'font-medium text-white' : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          {item.label}
        </Link>
      ))}
      <div className="flex-1" />
      <button
        onClick={logout}
        className="cursor-pointer rounded-md border border-neutral-700 bg-transparent px-4 py-1.5 text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
      >
        {'退出'}
      </button>
    </nav>
  );
}

interface LayoutShellProps {
  title: string;
  children: React.ReactNode;
}

export function LayoutShell({ title, children }: LayoutShellProps) {
  return (
    <>
      <Nav title={title} />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface NavProps {
  title: string;
  navItems?: Array<{ href: string; label: string }>;
}

const DEFAULT_ITEMS = [
  { href: '/', label: '\u9996\u9875' },
  { href: '/analyze', label: '\u8bd5\u9898\u5206\u6790' },
  { href: '/upload', label: '\u62cd\u7167\u4e0a\u4f20' },
  { href: '/grade', label: '\u667a\u80fd\u6279\u6539' },
  { href: '/chat', label: 'AI \u5bf9\u8bdd' },
  { href: '/plan', label: '\u5b66\u4e60\u8ba1\u5212' },
  { href: '/wrong-questions', label: '\u9519\u9898\u590d\u4e60' },
  { href: '/stats', label: '\u5b66\u4e60\u7edf\u8ba1' },
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
        {'\u9000\u51fa'}
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

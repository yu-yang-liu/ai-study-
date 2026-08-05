'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, ErrorBanner, SuccessBanner } from '@ai-study/core/ui';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Unknown error');
      return;
    }

    if (mode === 'register') {
      setMessage(data.message);
    } else {
      router.push('/');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-neutral-900">
          {mode === 'login' ? '\u767b\u5f55' : '\u6ce8\u518c'}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="邮箱"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
          />
          <Input
            label="密码"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
          />
          {error && <ErrorBanner message={error} />}
          {message && <SuccessBanner message={message} />}
          <Button type="submit" loading={loading} className="w-full">
            {mode === 'login' ? '登录' : '注册'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-neutral-500">
          {mode === 'login' ? '没有账号？' : '已有账号？'}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); setMessage(''); }}
            className="ml-1 cursor-pointer border-b border-slate-900 bg-transparent text-sm text-slate-900 hover:text-slate-700"
          >
            {mode === 'login' ? '注册' : '登录'}
          </button>
        </p>
      </Card>
    </div>
  );
}

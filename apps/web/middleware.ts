import { requireAuth } from '@ai-study/core';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 公开路径：直接放行（返回 undefined，Next 视为继续链）。
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/favicon.ico'
  ) {
    return;
  }

  // requireAuth 成功返回 { user, response }（response 带 x-user-id 头），
  // 失败返回 NextResponse（API 401 / 页面重定向 /login）。无 throw 控制流。
  const result = await requireAuth(req);
  if (result instanceof NextResponse) return result;
  return result.response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

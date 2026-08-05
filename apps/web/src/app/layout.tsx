import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ai-study - AI\u9ad8\u4e2d\u5b66\u4e60\u7cfb\u7edf',
  description: 'AI\u9ad8\u4e2d\u5b66\u4e60\u52a9\u624b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="m-0 min-h-screen bg-white font-sans">{children}</body>
    </html>
  );
}

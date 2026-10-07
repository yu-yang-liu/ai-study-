import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ai-study - AI高中学习系统',
  description: 'AI高中学习助手',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="m-0 min-h-screen bg-white font-sans">{children}</body>
    </html>
  );
}

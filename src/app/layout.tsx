import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '名人信息爬虫 - Celebrity Data Crawler',
  description: '收集名人公开信息，用于训练个性化Agent',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}

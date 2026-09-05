import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'CampusOne｜可信校园事务智能体',
  description: '以规则、证据和人工确认约束大模型的高校场地申请智能体。',
  icons: { icon: '/favicon.svg' },
  openGraph: {
    title: 'CampusOne｜可信校园事务智能体',
    description: '规则优先 · 证据可追溯 · 人工最终确认',
    images: ['/og.png'],
    locale: 'zh_CN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CampusOne｜可信校园事务智能体',
    description: '规则优先 · 证据可追溯 · 人工最终确认',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

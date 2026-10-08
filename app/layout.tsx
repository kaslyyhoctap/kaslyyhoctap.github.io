import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';
import { cn } from '@/lib/utils';
import { ThemeProvider } from '@/lib/theme';
import { SessionProvider } from 'next-auth/react';
import { Header } from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: {
    default: 'Ôn Tập 12 — Ôn thi Lịch Sử, Sinh Học, Hóa Học & Tiếng Anh lớp 12',
    template: `%s | Ôn Tập 12`,
  },
  description:
    'Ôn tập lý thuyết, luyện trắc nghiệm Lịch Sử 12, Sinh học 12 (Kết nối tri thức, Bài 1–3), Hóa học 12 (Chương 1–2) và Tiếng Anh 12 Global Success (Unit 1–2). Chấm điểm, giải thích, theo dõi tiến độ.',
  keywords: [
    'Ôn tập',
    'trắc nghiệm',
    'lịch sử 12',
    'sinh học 12',
    'hóa học 12',
    'tiếng anh 12',
    'global success',
    'kết nối tri thức',
  ],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
  },
  // Dark mode handled client-side by ThemeProvider (data-theme attribute + localStorage key ontap12-v1)
  // via the legacy styles.css [data-theme="dark"] selector.
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi" data-theme="light" className={cn('scroll-smooth', 'font-sans')}>
      <head>
        <meta name="theme-color" content="#F0FDFA" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0A1414" media="(prefers-color-scheme: dark)" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <SessionProvider>
            <Header />
            <main id="main" className="wrap">
              {children}
            </main>
            <Footer />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

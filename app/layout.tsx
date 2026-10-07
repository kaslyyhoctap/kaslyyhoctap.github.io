import type { Metadata, ReactNode } from 'react';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: 'ÔnTập12 — Ôn thi Lịch Sử, Sinh Học, Hóa Học & Tiếng Anh lớp 12',
    template: `%s | ÔnTập12`,
  },
  description:
    'Ôn tập lý thuyết, luyện trắc nghiệm Lịch Sử 12, Sinh học 12 (Kết nối tri thức, Bài 1–3), Hóa học 12 (Chương 1–2) và Tiếng Anh 12 Global Success (Unit 1–2). Chấm điểm, giải thích, theo dõi tiến độ.',
  keywords: [
    'Õn tập',
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
  // Chuyển theme sáng/tối qua CSS variable (cũng dùng ở Vanilla app.js)
  // Dark mode handled by client-side data-theme attribute + localStorage
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="vi" data-theme="light" className={cn("scroll-smooth", "font-sans", geist.variable)}>
      <head>
        <meta name="theme-color" content="#F0FDFA" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0A1414" media="(prefers-color-scheme: dark)" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ÔnTập12 — Ôn thi lớp 12',
    short_name: 'ÔnTập12',
    description: 'Ôn tập trắc nghiệm Sử, Sinh, Hóa, Anh lớp 12',
    start_url: '/',
    display: 'standalone',
    background_color: '#F0FDFA',
    theme_color: '#0B7F76',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

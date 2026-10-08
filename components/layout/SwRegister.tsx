/**
 * components/layout/SwRegister.tsx — đăng ký Service Worker offline.
 *
 * Chỉ đăng ký ở production (`/sw.js` do `next start` serve). Dev mode
 * (HMR) không đăng ký để tránh SW cache chặn hot-reload.
 */
'use client';

import { useEffect } from 'react';

export default function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline không khả dụng — app vẫn chạy online bình thường */
    });
  }, []);
  return null;
}

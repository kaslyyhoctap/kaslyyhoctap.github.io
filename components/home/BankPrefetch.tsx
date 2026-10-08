/**
 * components/home/BankPrefetch.tsx — tải ngầm bank về cache offline.
 *
 * Chạy 1 lần sau khi trang chủ mount (requestIdleCallback, fallback 3s),
 * chỉ khi đang online và chưa có cache. Kiểu TikTok preload: user lướt
 * trang chủ là bank đã nằm sẵn trong máy, mất mạng vẫn làm bài được.
 */
'use client';

import { useEffect } from 'react';
import { readBankCache, refreshBankCache } from '@/lib/offline';

export default function BankPrefetch() {
  useEffect(() => {
    if (!navigator.onLine) return;
    if (readBankCache()?.questions.length) return; // đã có cache
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => refreshBankCache().catch(() => {});
    if ('requestIdleCallback' in window) {
      const id = (window as any).requestIdleCallback(run, { timeout: 8000 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    timer = setTimeout(run, 3000);
    return () => clearTimeout(timer);
  }, []);
  return null;
}

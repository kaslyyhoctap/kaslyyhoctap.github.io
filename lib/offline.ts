/**
 * lib/offline.ts — offline question-bank cache ("tải sẵn DB xuống, mất mạng dùng cache").
 *
 * Flow: lần đầu có mạng, app fetch toàn bộ bank qua /api/questions (paged)
 * rồi lưu vào localStorage key versioned. Khi mất mạng / server fetch fail,
 * các trang đọc cache này thay vì báo lỗi.
 *
 * Chỉ cache dữ liệu học tập (questions/passages/theory/vocab) — tiến độ
 * (answered/hist/...) vốn đã ở ontap12-v1, không đụng.
 */
'use client';

import type { Question } from '@/lib/types';
import type { PassageMap } from '@/components/quiz/QuestionCard';

const BANK_KEY = 'ontap12-bank-v1';
const META_KEY = 'ontap12-bank-meta-v1';

export interface BankCache {
  questions: Question[];
  passages: PassageMap;
  savedAt: number;
}

export interface BankMeta {
  total: number;
  savedAt: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // quota đầy (508KB+ JSON) — cache bỏ qua, app vẫn chạy online
  }
}

/** Đọc bank đã cache (null = chưa từng tải). */
export function readBankCache(): BankCache | null {
  return read<BankCache>(BANK_KEY);
}

/** Đọc meta (tổng số câu lúc cache) để hiện "dữ liệu offline". */
export function readBankMeta(): BankMeta | null {
  return read<BankMeta>(META_KEY);
}

/**
 * Tải toàn bộ bank từ API rồi lưu cache. Gọi 1 lần khi có mạng
 * (vd sau khi vào trang chủ), hoặc gọi lại để refresh.
 * Trả về true nếu cache thành công.
 */
export async function refreshBankCache(
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const LIMIT = 500;
  let offset = 0;
  const all: Question[] = [];
  let total = 0;
  // Passages: lấy 1 lần qua quiz page props — ở đây fetch riêng nếu có endpoint,
  // fallback {} (quiz vẫn chạy, chỉ thiếu đoạn đọc).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchFn(
      `/api/questions?limit=${LIMIT}&offset=${offset}`,
    );
    if (!res.ok) throw new Error(`bank fetch failed: ${res.status}`);
    const data = await res.json();
    all.push(...(data.questions as Question[]));
    total = data.total as number;
    offset += LIMIT;
    if (all.length >= total || !data.questions.length) break;
  }
  const okCache = write(BANK_KEY, {
    questions: all,
    passages: {},
    savedAt: Date.now(),
  } satisfies BankCache);
  write(META_KEY, { total, savedAt: Date.now() } satisfies BankMeta);
  return okCache && all.length > 0;
}

/**
 * Lọc bank đã cache theo subject/lesson như getQuestions.
 * Dùng khi server fetch fail (offline).
 */
export function queryBankCache(
  cache: BankCache,
  opts: { subject?: string; lesson?: number | 'all' },
): Question[] {
  return cache.questions.filter((q) => {
    if (opts.subject && q.subject !== opts.subject) return false;
    if (opts.lesson != null && opts.lesson !== 'all' && q.lesson !== opts.lesson)
      return false;
    return true;
  });
}

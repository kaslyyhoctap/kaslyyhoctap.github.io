/**
 * tests/admin/page-gates.test.ts — wave C (T1 P0): every page under
 * app/admin/ calls requireAdmin() BEFORE any DB fetch and renders
 * notFound() (never redirect(), never question data) when signed out.
 *
 * The layout's redirect stays as UX sugar, but these page-level gates are
 * the authoritative fix: concurrent RSC segment rendering means the layout
 * alone cannot win the race against a streaming child.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Signed-out state: requireAdmin rejects.
const mockRequireAdmin = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth-utils', () => ({ requireAdmin: mockRequireAdmin }));

// notFound() throws in real Next — emulate with a sentinel.
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const mockGetQuestions = vi.hoisted(() => vi.fn());
const mockGetQuestionById = vi.hoisted(() => vi.fn());
vi.mock('@/lib/db/queries', () => ({
  getQuestions: mockGetQuestions,
  getQuestionById: mockGetQuestionById,
}));

vi.mock('next/link', () => ({ default: () => null }));

import AdminDashboard from '@/app/admin/page';
import AdminQuestions from '@/app/admin/questions/page';
import NewQuestionPage from '@/app/admin/questions/new/page';
import EditQuestionPage from '@/app/admin/questions/[id]/edit/page';

describe('admin page gates (wave C, signed out)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockRejectedValue(new Error('Unauthorized'));
  });

  it('/admin → notFound, zero DB queries (kills the 4×10000 fan-out)', async () => {
    await expect(AdminDashboard()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockRequireAdmin).toHaveBeenCalled();
    expect(mockGetQuestions).not.toHaveBeenCalled();
  });

  it('/admin/questions → notFound, zero DB queries', async () => {
    await expect(AdminQuestions()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetQuestions).not.toHaveBeenCalled();
  });

  it('/admin/questions/new → notFound (no form shell leaks)', async () => {
    await expect(NewQuestionPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('/admin/questions/:id/edit → notFound BEFORE getQuestionById (no answer leak)', async () => {
    await expect(
      EditQuestionPage({ params: Promise.resolve({ id: 'bio1-01' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockGetQuestionById).not.toHaveBeenCalled();
  });
});

/**
 * tests/components/explain-button.test.tsx — XSS regression for the AI
 * explanation panel (B01 in the audit).
 *
 * The non-chemistry branch used to pipe the raw model reply straight into
 * `dangerouslySetInnerHTML`, so a prompt-injected / malformed response could
 * inject HTML into the result page. It must now render as literal text.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExplainButton from '@/components/ai/ExplainButton';
import type { RuntimeQuestion } from '@/lib/quiz/scoring';

const XSS_PAYLOAD = '<img src=x onerror="window.__xss=1">Hãy chọn A.';

function makeQ(subject: string): RuntimeQuestion {
  return {
    id: 'h1',
    subject,
    lesson: 1,
    type: 'multiple_choice',
    question: 'Câu hỏi?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    opts: [
      { t: 'A', ok: true },
      { t: 'B', ok: false },
      { t: 'C', ok: false },
      { t: 'D', ok: false },
    ],
    tf: [],
    sa: '',
  };
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ explanation: XSS_PAYLOAD }),
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function explain(subject: string) {
  render(<ExplainButton q={makeQ(subject)} userAnswer={1} />);
  await userEvent.click(screen.getByRole('button'));
  // The panel only renders once the reply has been stored in state.
  await waitFor(() =>
    expect(document.querySelector('.ai-explain')?.textContent).toContain('Hãy chọn A'),
  );
  return document.querySelector('.ai-explain') as HTMLElement;
}

describe('ExplainButton rendering', () => {
  it('renders a non-chemistry explanation as literal text, not HTML', async () => {
    const panel = await explain('history');

    expect(panel.querySelector('img')).toBeNull();
    expect(panel.querySelector('script')).toBeNull();
    expect(panel.textContent).toContain('<img src=x onerror="window.__xss=1">');
  });

  it('does not execute injected markup for biology/english either', async () => {
    for (const subject of ['biology', 'english']) {
      cleanup();
      const panel = await explain(subject);
      expect(panel.querySelector('img')).toBeNull();
      expect(panel.textContent).toContain('<img src=x onerror=');
    }
  });

  it('keeps chemFormat markup for chemistry (escaped input, real sub tags)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ explanation: 'Công thức C2H5OH.' }),
    });
    render(<ExplainButton q={makeQ('chemistry')} userAnswer={1} />);
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(document.querySelector('.ai-explain sub')?.textContent).toBe('2'),
    );
    const panel = document.querySelector('.ai-explain') as HTMLElement;
    expect(panel.querySelector('img')).toBeNull();
  });
});

/**
 * app/vocab/page.tsx — vocabulary flashcard entry point (Task 3.8).
 *
 * Server Component: reads the `unit` from URL search params (defaults to "1"),
 * fetches that unit's vocabulary via `getVocabulary(unit)` (mirrors app.js
 * global `window.VOCAB[unit]`), and collects the distinct unit list for the
 * selector. Passes everything to the client `<VocabView>` wrapper, which
 * owns all interactive state (flip, shuffle, star, know, hideAll, etc.).
 *
 * Next.js 16 breaking change: `searchParams` is a Promise — must `await`.
 */
import Link from 'next/link';
import { db } from '@/db';
import { vocabulary as vocabTable } from '@/db/schema';
import { getVocabulary } from '@/lib/db/queries';
import { subjectName } from '@/lib/meta';
import VocabView from '@/components/vocab/VocabView';

export const metadata = {
  title: 'Flashcard từ vựng',
};

type VocabRow = { unit: string };

export default async function VocabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  // app.js $("vUnit").value || "1" — unit from URL, default "1".
  const unit = typeof sp.unit === 'string' && sp.unit ? sp.unit : '1';

  let vocabulary: Awaited<ReturnType<typeof getVocabulary>> = [];
  let units: string[] = [];
  let error: string | null = null;

  try {
    // Fetch vocabulary for the current unit (mirrors window.VOCAB[unit] in app.js).
    vocabulary = await getVocabulary(unit);

    // Collect distinct units for the selector dropdown.
    const unitRows = (await db
      .select({ unit: vocabTable.unit })
      .from(vocabTable)) as VocabRow[];
    units = Array.from(new Set(unitRows.map((r) => r.unit))).sort();
  } catch (err) {
    console.error('[VocabPage] DB fetch failed:', err);
    error = 'Không thể tải từ vựng. Vui lòng thử lại sau.';
  }

  if (error) {
    return (
      <>
        <Link href="/english" className="link">
          ← {subjectName('english')}
        </Link>
        <div className="panel">
          <p className="muted">{error}</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Link href="/english" className="link">
        ← {subjectName('english')}
      </Link>
      {/* key={unit} forces a remount when the unit changes via URL,
          resetting all client-side state (index, flip, filters, masks). */}
      <VocabView key={unit} vocabulary={vocabulary} unit={unit} units={units} />
    </>
  );
}

/**
 * Shared skeleton primitives for route `loading.tsx` files.
 * Pure markup + theme-aware CSS (`.skel*` in styles.css) — no JS, no deps.
 * Keep shapes close to the real panels so the swap-in doesn't jump layout.
 */
export function SkelTitle() {
  return (
    <div className="skel-block" aria-hidden="true">
      <div className="skel-line skel-title" />
      <div className="skel-line w80" />
    </div>
  );
}

export function SkelText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skel-block" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`skel-line ${i % 3 === 0 ? 'w60' : i % 3 === 1 ? '' : 'w80'}`}
        />
      ))}
    </div>
  );
}

export function SkelCards({ count = 3 }: { count?: number }) {
  return (
    <div className="skel-cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skel-card" />
      ))}
    </div>
  );
}

/** Full route fallback: announced to screen readers via role="status". */
export default function RouteSkeleton({
  cards = 3,
  textLines = 0,
}: {
  cards?: number;
  textLines?: number;
}) {
  return (
    <div className="skel" role="status" aria-label="Đang tải nội dung">
      <SkelTitle />
      {textLines > 0 && <SkelText lines={textLines} />}
      {cards > 0 && <SkelCards count={cards} />}
    </div>
  );
}

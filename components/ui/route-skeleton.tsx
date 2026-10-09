/**
 * Per-route skeletons mirroring each page's real layout.
 * Pure markup + theme-aware CSS (`.skel*` in styles.css) — no JS, no deps.
 * Shapes match the destination page so the swap-in doesn't jump layout.
 */

function L({ w = '' }: { w?: string }) {
  return <div className={`skel-line ${w}`} aria-hidden="true" />;
}

/** Home: hero 2-col + subject cards + lesson cards + guide panel. */
export function HomeSkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải trang chủ">
      <div className="skel-hero" aria-hidden="true">
        <div className="skel-herotxt">
          <L w="w40" />
          <div className="skel-line skel-title" />
          <L w="w80" />
          <div className="skel-cta">
            <div className="skel-btn" />
            <div className="skel-btn" />
          </div>
        </div>
        <div className="skel-herocard" />
      </div>
      <div className="skel-line skel-sect" aria-hidden="true" />
      <div className="skel-grid2" aria-hidden="true">
        <div className="skel-card" />
        <div className="skel-card" />
      </div>
      <div className="skel-line skel-sect" aria-hidden="true" />
      <div className="skel-grid3" aria-hidden="true">
        <div className="skel-card" />
        <div className="skel-card" />
        <div className="skel-card" />
      </div>
    </div>
  );
}

/** Subject: heading + config form + lesson cards. */
export function SubjectSkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải môn học">
      <L w="w40" />
      <div className="skel-line skel-title" aria-hidden="true" />
      <L w="w80" />
      <div className="skel-block" aria-hidden="true">
        <div className="skel-line skel-title" />
        <div className="skel-form3">
          <div className="skel-field" />
          <div className="skel-field" />
          <div className="skel-field" />
        </div>
      </div>
      <div className="skel-grid3" aria-hidden="true">
        <div className="skel-card" />
        <div className="skel-card" />
        <div className="skel-card" />
      </div>
    </div>
  );
}

/** Theory: eyebrow + title + long article. */
export function TheorySkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải lý thuyết">
      <L w="w40" />
      <div className="skel-block" aria-hidden="true">
        <L w="w40" />
        <div className="skel-line skel-title" />
        <L />
        <L w="w80" />
        <L w="w60" />
        <L />
        <L w="w80" />
        <L w="w60" />
      </div>
    </div>
  );
}

/** Quiz: timer header + question card + palette sidebar. */
export function QuizSkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải đề thi">
      <div className="skel-block" aria-hidden="true">
        <div className="skel-quizmeta">
          <L w="w60" />
          <div className="skel-timer" />
        </div>
        <div className="skel-line" />
      </div>
      <div className="skel-quizgrid" aria-hidden="true">
        <div className="skel-block">
          <div className="skel-line skel-title" />
          <div className="skel-opt" />
          <div className="skel-opt" />
          <div className="skel-opt" />
          <div className="skel-opt" />
        </div>
        <div className="skel-block">
          <div className="skel-line skel-title" />
          <div className="skel-pal" />
        </div>
      </div>
    </div>
  );
}

/** Result: score hero + 4 stat boxes + review rows. */
export function ResultSkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải kết quả">
      <div className="skel-block skel-center" aria-hidden="true">
        <div className="skel-score" />
        <L w="w40" />
        <div className="skel-stats4">
          <div className="skel-stat" />
          <div className="skel-stat" />
          <div className="skel-stat" />
          <div className="skel-stat" />
        </div>
      </div>
      <div className="skel-block" aria-hidden="true">
        <div className="skel-line skel-title" />
        <L />
        <L w="w80" />
      </div>
      <div className="skel-block" aria-hidden="true">
        <div className="skel-line skel-title" />
        <L />
        <L w="w60" />
      </div>
    </div>
  );
}

/** Bank: search + filter row + question rows. */
export function BankSkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải ngân hàng câu hỏi">
      <div className="skel-line skel-title" aria-hidden="true" />
      <div className="skel-block" aria-hidden="true">
        <div className="skel-search" />
        <div className="skel-form5">
          <div className="skel-field" />
          <div className="skel-field" />
          <div className="skel-field" />
          <div className="skel-field" />
          <div className="skel-field" />
        </div>
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <div className="skel-block" key={i} aria-hidden="true">
          <L />
          <L w="w60" />
        </div>
      ))}
    </div>
  );
}

/** Vocab: big flashcard + thumbnail grid. */
export function VocabSkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải từ vựng">
      <div className="skel-line skel-title" aria-hidden="true" />
      <div className="skel-block" aria-hidden="true">
        <div className="skel-search" />
      </div>
      <div className="skel-flash" aria-hidden="true" />
      <div className="skel-grid3" aria-hidden="true">
        <div className="skel-card" />
        <div className="skel-card" />
        <div className="skel-card" />
      </div>
    </div>
  );
}

/** Progress: subject panels + chart + history rows. */
export function ProgressSkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải tiến độ">
      <div className="skel-line skel-title" aria-hidden="true" />
      <div className="skel-grid2" aria-hidden="true">
        <div className="skel-block">
          <div className="skel-line skel-title" />
          <L />
          <L w="w80" />
        </div>
        <div className="skel-block">
          <div className="skel-line skel-title" />
          <L />
          <L w="w60" />
        </div>
      </div>
      <div className="skel-block" aria-hidden="true">
        <div className="skel-line skel-title" />
        <L />
        <L w="w80" />
        <L w="w60" />
      </div>
    </div>
  );
}

/** AI generate: config form + CTA. */
export function AiSkeleton() {
  return (
    <div className="skel" role="status" aria-label="Đang tải tạo đề AI">
      <div className="skel-line skel-title" aria-hidden="true" />
      <L w="w80" />
      <div className="skel-block" aria-hidden="true">
        <div className="skel-form3">
          <div className="skel-field" />
          <div className="skel-field" />
          <div className="skel-field" />
        </div>
        <div className="skel-cta1" />
      </div>
    </div>
  );
}

/**
 * Site header — ports `<header class="header">` from index.html.
 *
 * Client component because it manages mobile-nav + subject-dropdown state
 * and contains the ThemeToggle (which itself is a client component).
 */
'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { AuthButton } from '@/components/auth/AuthButton';
import { META, SUBJECTS, subjectName } from '@/lib/meta';

export function Header() {
  const [navOpen, setNavOpen] = useState(false);
  const [subjOpen, setSubjOpen] = useState(false);
  const [explOpen, setExplOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();

  // Close nav + dropdown on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setSubjOpen(false);
        setExplOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Outside click: close dropdown (but not individual nav links — those navigate).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.nav-group')) {
        setSubjOpen(false);
        setExplOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // Body class for mobile sidebar (consumed by styles.css).
  useEffect(() => {
    if (navOpen) {
      document.body.classList.add('nav-open');
    } else {
      document.body.classList.remove('nav-open');
    }
    return () => document.body.classList.remove('nav-open');
  }, [navOpen]);

  // Body class for dropdown state (desktop needs overflow:visible when open).
  useEffect(() => {
    document.body.classList.toggle('subj-open', subjOpen || explOpen);
  }, [subjOpen, explOpen]);

  const isSubjectRoute = SUBJECTS.includes(pathname.split('/')[1] || '');
  // /notebook redirects to /bank?st=star — the star view is a query state on
  // /bank, so the active link must read the query (not just the pathname),
  // otherwise both links highlight at once. Header sits in the root layout,
  // which needs a Suspense boundary for useSearchParams (see app/layout.tsx).
  const searchParams = useSearchParams();
  const isStarView = searchParams.get('st') === 'star';
  const isBankRoute = pathname.startsWith('/bank') && !isStarView;
  const isNotebookView =
    pathname.startsWith('/notebook') ||
    (pathname.startsWith('/bank') && isStarView);
  const isExploreRoute = ['/bank', '/notebook', '/vocab', '/progress'].some((p) =>
    pathname.startsWith(p),
  );
  const closeNav = () => setNavOpen(false);

  return (
    <>
      <a className="skip-link" href="#main">
        Bỏ qua tới nội dung chính
      </a>

      <header className="header" role="banner">
        <div className="wrap header-in">
          {/* Mobile menu button */}
          <button
            type="button"
            className="icon-btn menu-btn"
            aria-label="Mở menu"
            aria-expanded={navOpen}
            aria-controls="mainNav"
            onClick={() => setNavOpen(!navOpen)}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
            <span id="menuLbl">Menu</span>
          </button>

          {/* Logo */}
          <Link href="/" className="logo" aria-label="ÔnTập12 trang chủ" onClick={closeNav}>
            <span className="logo-mark" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3 2 8l10 5 10-5-10-5Z" />
                <path d="M6 10.5V15c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
                <path d="M22 8v6" />
              </svg>
            </span>
            <span className="logo-t">
              Ôn Tập<b>12</b>
            </span>
            <span className="logo-sub">Kết nối tri thức</span>
          </Link>

          {/* Desktop nav */}
          <nav className={`nav ${navOpen ? '' : ''}`} id="mainNav" aria-label="Đi phương hướng chính">
            <Link
              href="/"
              className={`nav-btn${pathname === '/' ? ' active' : ''}`}
              onClick={closeNav}
            >
              Trang chủ
            </Link>

            <div className="nav-group">
              <button
                type="button"
                className={`nav-btn${isSubjectRoute ? ' active' : ''}`}
                id="subjBtn"
                aria-haspopup="true"
                aria-expanded={subjOpen}
                aria-controls="subjMenu"
                onClick={() => {
                  setSubjOpen(!subjOpen);
                  setExplOpen(false);
                }}
              >
                Môn học{' '}
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div
                className="nav-menu"
                id="subjMenu"
                role="menu"
                hidden={!subjOpen}
              >
                {SUBJECTS.map((sub) => (
                  <Link
                    key={sub}
                    href={`/${sub}`}
                    className="nav-btn"
                    role="menuitem"
                    onClick={closeNav}
                  >
                    {subjectName(sub)}
                  </Link>
                ))}
              </div>
            </div>

            <div className="nav-group">
              <button
                type="button"
                className={`nav-btn${explOpen ? ' active' : ''}${isExploreRoute ? ' active' : ''}`}
                id="explBtn"
                aria-haspopup="true"
                aria-expanded={explOpen}
                aria-controls="explMenu"
                onClick={() => {
                  setExplOpen(!explOpen);
                  setSubjOpen(false);
                }}
              >
                Khám phá{' '}
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div
                className="nav-menu"
                id="explMenu"
                role="menu"
                hidden={!explOpen}
              >
                <Link
                  href="/bank"
                  className={`nav-btn${isBankRoute ? ' active' : ''}`}
                  role="menuitem"
                  onClick={closeNav}
                >
                  Ngân hàng câu hỏi
                </Link>
                <Link
                  href="/notebook"
                  className={`nav-btn${isNotebookView ? ' active' : ''}`}
                  role="menuitem"
                  onClick={closeNav}
                >
                  Sổ tay
                </Link>
                <Link
                  href="/vocab"
                  className={`nav-btn${pathname.startsWith('/vocab') ? ' active' : ''}`}
                  role="menuitem"
                  onClick={closeNav}
                >
                  Từ vựng
                </Link>
                <Link
                  href="/progress"
                  className={`nav-btn${pathname.startsWith('/progress') ? ' active' : ''}`}
                  role="menuitem"
                  onClick={closeNav}
                >
                  Tiến độ
                </Link>
              </div>
            </div>
            <Link
              href="/ai/generate"
              className={`nav-btn${pathname.startsWith('/ai') ? ' active' : ''}`}
              onClick={closeNav}
            >
              Tạo đề AI
            </Link>
            {/* Mobile-only: auth in the drawer (`.auth-btn` is hidden at ≤320px) */}
            {session ? (
              <button
                type="button"
                className="nav-btn auth-drawer-btn"
                onClick={() => void signOut()}
              >
                Đăng xuất{session.user?.name ? ` (${session.user.name})` : ''}
              </button>
            ) : (
              <Link href="/login" className="nav-btn auth-drawer-btn" onClick={closeNav}>
                Đăng nhập
              </Link>
            )}
          </nav>

          {/* Mobile scrim — visibility fully controlled by body.nav-open (see styles.css);
              no `hidden` attr: mobile CSS uses display:block!important which would override it */}
          <div
            className="scrim"
            id="navScrim"
            aria-hidden={!navOpen}
            onClick={() => setNavOpen(false)}
          />

          {/* Right-side actions */}
          <div className="header-act">
            <AuthButton />
            <ThemeToggle />
            <Link href="/quick" className="btn btn-primary btn-sm">
              Kiểm tra nhanh
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}

'use client';

import { useSession, signOut } from 'next-auth/react';
import { signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export function AuthButton() {
  const { data: session, status, status: _s } = useSession();
  const loading = status === 'loading';
  const [actionLoading, setActionLoading] = useState(false);

  if (loading || actionLoading) {
    return <div className="auth-btn-skeleton" aria-label="Loading auth" />;
  }

  if (!session) {
    return (
      <Button
        onClick={() => {
          setActionLoading(true);
          void signIn('google');
        }}
        size="sm"
        variant="ghost"
        aria-label="Sign in with Google"
        className="auth-btn"
      >
        <GoogleIcon />
        <span>Đăng nhập</span>
      </Button>
    );
  }

  return (
    <button
      type="button"
      className="auth-btn auth-btn-signed"
      aria-label={`${session.user?.name || 'Tôi'} — đăng xuất`}
      onClick={() => {
        setActionLoading(true);
        void signOut();
      }}
      title="Đăng xuất"
    >
      {session.user?.image ? (
        <img
          src={session.user.image}
          alt={session.user.name || 'avatar'}
          width={28}
          height={28}
          className="auth-avatar"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="auth-initial">
          {(session.user?.name?.[0] || session.user?.email?.[0] || '?')
            .toUpperCase()}
        </span>
      )}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        fill="#4285E8"
        d="M22.575 10.375h-.013V10.25h-9.625v4.1875h5.941a5.146 5.146 0 01-2.269 2.812l-.001-.001c1.757 1.337 3.893 2.094 6.25 1.74 1.836-.555 3.38-1.904 4.285-3.768l.001-.001c.814-1.85 1.173-3.986 1.002-6.112-.17-2.126-1.04-4.138-2.508-5.606l-.001.001c-1.47-1.466-3.58-2.448-5.798-2.797l-.001.001C13.434 3.575 10.333 1.75 7.066 2.566 3.801 3.383 1.735 6.244 1.066 9.51 1.066 16.672 7.013 21.625 7.066 21.672"
      />
    </svg>
  );
}

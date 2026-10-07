'use client';

import { signIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function SignIn() {
  return (
    <Button onClick={() => void signIn('google')} aria-label="Sign in with Google">
      Sign in with Google
    </Button>
  );
}

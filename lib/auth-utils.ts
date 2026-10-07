import { auth } from '@/lib/auth';

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') throw new Error('Unauthorized');
  return user;
}

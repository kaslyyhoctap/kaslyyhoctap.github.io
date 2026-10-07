import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import type { DefaultSession } from 'next-auth';
import { db } from '@/db';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';

export const {
  auth,
  signIn,
  signOut,
  handlers: { GET, POST },
} = NextAuth(() => ({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET!,
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.role =
        user.email === process.env.ADMIN_EMAIL ? 'admin' : 'user';
      return session;
    },
  },
}));

// NextAuth type augmentation — add `role` to the session user.
declare module 'next-auth' {
  interface Session {
    user: {
      role: 'admin' | 'user';
    } & DefaultSession['user'];
  }
}

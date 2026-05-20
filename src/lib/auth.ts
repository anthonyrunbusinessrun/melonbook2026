import NextAuth, { type NextAuthOptions, type Session } from 'next-auth';
import { type JWT } from 'next-auth/jwt';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryOne } from '@/db';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await queryOne<{
          id: string; email: string; name: string; role: string;
          hashed_password: string; is_active: boolean;
        }>(
          'SELECT id, email, name, role, hashed_password, is_active FROM app_users WHERE email = $1',
          [credentials.email]
        );
        if (!user || !user.is_active) return null;
        const valid = await bcrypt.compare(credentials.password, user.hashed_password);
        if (!valid) return null;
        await queryOne('UPDATE app_users SET last_login_at = NOW() WHERE id = $1', [user.id]);
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).id = token.id;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET || 'melonops-dev-secret-change-in-production',
};

export const { handlers, signIn, signOut, auth } = NextAuth(authOptions);

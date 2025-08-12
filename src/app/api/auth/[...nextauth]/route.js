import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/db";

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from: process.env.EMAIL_FROM,
      maxAge: 15 * 60, // 15 minutes
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      if (!user?.email?.endsWith("@capplc.com")) return false;
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
      if (!dbUser || !dbUser.isActive) return false;
      return true;
    },
    async jwt({ token, user }) {
      // On first JWT creation attach role & department
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
        if (dbUser) {
          token.role = dbUser.role;
          token.department = dbUser.department;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.department = token.department;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Role-based post-login landing
      if (url.startsWith('http') && !url.startsWith(baseUrl)) return baseUrl; // disallow external
      // Keep explicit callbackUrl if pointing to protected area
      try {
        const u = new URL(url, baseUrl);
        if (u.pathname === '/' || u.pathname.startsWith('/login')) {
          // Without access to token here, default user landing to /bids
          return baseUrl + '/bids';
        }
        return u.toString();
      } catch { return baseUrl; }
    }
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
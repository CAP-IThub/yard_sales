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
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        // Custom email logic can go here if needed
        // For now, use default
        return provider.sendVerificationRequest({ identifier, url, provider });
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile, email, credentials }) {
      // Only allow preloaded, active company users
      if (!user?.email?.endsWith("@capplc.com")) return false;
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } });
      if (!dbUser || !dbUser.isActive) return false;
      return true;
    },
    async session({ session, token, user }) {
      // Add role and department to session for RBAC
      if (session?.user?.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.department = dbUser.department;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

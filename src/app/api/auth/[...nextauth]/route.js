import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@auth/prisma-adapter";
import prisma from "@/lib/db";
import nodemailer from "nodemailer";

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
      async sendVerificationRequest({ identifier, url, provider, theme }) {
        const transport = nodemailer.createTransport(provider.server);
        const appName = process.env.APP_NAME || 'Yard Sales';
        const supportEmail = process.env.SUPPORT_EMAIL || 'itsupport@capplc.com';
        const { host } = new URL(url);
        const expiresMinutes = (provider.maxAge || 900) / 60;

        const subject = `${appName} sign-in link (expires in ${expiresMinutes} min)`;

        const text = `Hi,
\nClick the secure link below to sign in to ${appName}.
\n${url}
\nThis link expires in ${expiresMinutes} minutes and can be used only once. If it expires, just request a new one from the sign-in page.
\nWhy am I getting this email? Someone (hopefully you) entered your corporate email on the ${appName} sign-in page. We only allow *@capplc.com addresses.
\nIf you did NOT request this, you can safely ignore it—no account access was granted.
\nNeed help? Contact ${supportEmail}.
\n— ${appName} Team`;

        const html = `<!DOCTYPE html><html><head><meta charSet="utf-8" />
<title>${appName} Sign-In</title>
<style>
  body { font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif; background:#0f1115; color:#f5f7fa; margin:0; padding:0; }
  a.button { display:inline-block; background:#2563eb; color:#fff !important; text-decoration:none; padding:14px 22px; border-radius:8px; font-weight:600; letter-spacing:.3px; }
  .container { max-width:560px; margin:0 auto; padding:32px 28px 40px; }
  .panel { background:#1a1f27; padding:28px 26px 34px; border:1px solid #2a3140; border-radius:14px; }
  h1 { font-size:20px; margin:0 0 18px; font-weight:600; }
  p { line-height:1.5; margin:0 0 16px; }
  code { background:#11161d; padding:2px 6px; border-radius:5px; font-size:13px; }
  .meta { font-size:12px; color:#94a3b8; margin-top:28px; line-height:1.4; }
  .divider { height:1px; background:#222b36; margin:28px 0; }
  @media (prefers-color-scheme: light) {
    body { background:#f5f7fb; color:#1e2934; }
    .panel { background:#ffffff; border-color:#e2e8f0; }
    code { background:#f1f5f9; }
    .meta { color:#64748b; }
    a.button { background:#2563eb; }
  }
</style></head>
<body>
  <div class="container">
    <div class="panel">
      <h1>${appName} sign‑in link</h1>
      <p>Hi${identifier ? `, <strong>${identifier.split('@')[0]}</strong>` : ''} 👋</p>
      <p>Use the secure button below to finish signing in to <strong>${appName}</strong> on <strong>${host}</strong>.</p>
      <p style="text-align:center;margin:32px 0 30px;">
        <a class="button" href="${url}">Sign in to ${appName}</a>
      </p>
      <p>If the button doesn’t work, copy & paste this URL into your browser:</p>
      <p><code style="word-break:break-all;">${url}</code></p>
      <div class="divider"></div>
      <p><strong>Expires:</strong> in ${expiresMinutes} minutes. It can be used only once.</p>
      <p><strong>Security:</strong> Only corporate emails (<code>@capplc.com</code>) are allowed. If you didn’t request this link you can ignore and delete this email.</p>
      <p><strong>Need help?</strong> Reach us at <a href="mailto:${supportEmail}" style="color:#3b82f6;">${supportEmail}</a>.</p>
      <p class="meta">You received this email because a sign‑in was requested for <code>${identifier}</code> on ${appName}.<br/>${appName} • ${host}</p>
    </div>
  </div>
</body></html>`;

        await transport.sendMail({
          to: identifier,
          from: provider.from,
          replyTo: supportEmail,
          subject,
          text,
          html,
        });
      }
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
      // Always refresh role/department each JWT callback to avoid stale role after DB changes
      const email = user?.email || token.email;
      if (email) {
        const dbUser = await prisma.user.findUnique({ where: { email }, select: { role: true, department: true } });
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
          // Send to bridging page that will redirect by role
          return baseUrl + '/post-login';
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
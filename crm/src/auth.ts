/**
 * CRM Auth.js v5 configuration.
 *
 * Credentials provider against the CRM's own staff User table with bcrypt
 * hashing and a signed-JWT session. Staff identities are entirely separate
 * from trading-platform clients; cookies are scoped to the CRM subdomain.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";

// A missing secret must never degrade into per-boot ephemeral keys: any
// session cookie issued before a restart would become undecryptable and
// surface as "no matching decryption secret" far from the real cause.
if (!process.env.AUTH_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required — generate one with: openssl rand -base64 32");
  }
  console.warn(
    "[crm/auth] AUTH_SECRET is not set; sessions will break on restart. Add it to crm/.env.",
  );
}

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  // Distinct cookie names are REQUIRED for local development: the trading
  // platform (localhost:3000) and this app (localhost:3100) share the
  // localhost cookie jar (cookies ignore ports), and Auth.js's default
  // `authjs.*` names would make the two sessions overwrite each other —
  // log into one, get logged out of the other. Host-scoped in production,
  // but the prefix stays as cheap insurance.
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-crm.session-token" : "crm.session-token",
    },
    csrfToken: { name: "crm.csrf-token" },
    callbackUrl: { name: "crm.callback-url" },
    state: { name: "crm.oauth-state" },
    pkceCodeVerifier: { name: "crm.pkce-code-verifier" },
  },
  // Trust forwarded host headers automatically only in development.
  // Production behind Caddy must opt in via AUTH_TRUST_HOST after the
  // reverse proxy is verified.
  trustHost:
    process.env.NODE_ENV !== "production" ||
    (process.env.AUTH_TRUST_HOST ?? "false").toLowerCase() === "true",
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = CredentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true, status: true, role: { select: { key: true } } },
        });
        // Uniform null on unknown email / disabled account / bad password so
        // responses don't reveal which part failed.
        if (!user || user.status !== "ACTIVE") return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleKey: user.role.key,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.roleKey = user.roleKey;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.id === "string" && session.user) {
        session.user.id = token.id;
      }
      if (typeof token.roleKey === "string" && session.user) {
        session.user.roleKey = token.roleKey;
      }
      return session;
    },
  },
});

/** Hash a password for storage (bcrypt cost 12, matching the platform). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

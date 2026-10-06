/**
 * Extend the NextAuth session types so `session.user.id` is known.
 */
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      adminRoles?: string[];
    } & DefaultSession["user"];
    securitySessionId?: string;
  }

  interface User {
    role?: string;
    adminRoles?: string[];
    securitySessionId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    adminRoles?: string[];
    securitySessionId?: string;
  }
}

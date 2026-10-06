import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roleKey: string;
    } & DefaultSession["user"];
  }

  interface User {
    roleKey?: string;
  }
}

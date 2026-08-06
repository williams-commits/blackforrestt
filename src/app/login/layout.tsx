import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Log in to your trading account.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

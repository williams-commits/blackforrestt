import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open Account",
  description: "Create a new trading account in minutes.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

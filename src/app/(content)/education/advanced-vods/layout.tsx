import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advanced Video Course",
  description: "Advanced trading video course covering multi-timeframe analysis, money management, and trading psychology.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trading Signals",
  description: "Live trading signals with automated technical indicators across forex, commodities, indices, and crypto.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

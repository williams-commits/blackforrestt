import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trading Calculators",
  description: "Free trading calculators — position size, margin, pip value, profit/loss, and risk-reward ratio.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

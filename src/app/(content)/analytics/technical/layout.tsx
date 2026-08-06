import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Technical Analysis",
  description: "Real-time technical analysis with live charts, indicators, and automated signal detection across major instruments.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

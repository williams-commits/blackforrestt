import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Economic Calendar",
  description: "Real-time economic calendar with upcoming events, forecasts, and impact ratings for forex and global markets.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

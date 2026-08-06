import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Beginners Video Course",
  description: "Free video lessons for beginner traders — learn the markets from candlesticks to your first trade.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

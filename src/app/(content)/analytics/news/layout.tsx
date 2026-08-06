import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Market News",
  description: "Latest financial market news and breaking updates affecting forex, commodities, indices, and crypto.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

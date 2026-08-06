import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cryptocurrency Video Course",
  description: "Cryptocurrency trading video course — blockchain basics, market structure, risk management, and avoiding scams.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

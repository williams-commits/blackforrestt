import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BlackForest Trade",
  description: "Trading terminal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ background: "#0e1116", color: "#e6edf3", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

// Same font variables the platform design system expects (globals.css
// reads --font-sans-loaded / --font-mono-loaded in its @theme block).
const sans = Montserrat({ subsets: ["latin"], display: "swap", variable: "--font-sans-loaded" });
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono-loaded" });

export const metadata: Metadata = {
  title: "BlackForest Trade",
  description: "Trading terminal",
};

/*
  Applies the persisted theme (blckforest-theme cookie, falling back to
  localStorage) before first paint so the dim palette never flashes. Mirrors
  the web app's script and must stay a plain string — no JSX — so it
  serializes verbatim.
*/
const themeNoFlashScript = `(function(){try{var t=document.cookie.match(/blckforest-theme=(\\w+)/);t=t?t[1]:localStorage.getItem('blckforest-theme');if(t==='dim'){document.documentElement.classList.add('dim');}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body className="bg-canvas text-text antialiased">
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <Providers>{children}</Providers>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

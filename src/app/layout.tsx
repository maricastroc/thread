import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next, Newsreader } from "next/font/google";
import Script from "next/script";
import { AudioProvider } from "@/components/audio/AudioProvider";
import { MiniPlayer } from "@/components/audio/MiniPlayer";
import { t } from "@/lib/i18n";
import { loadVault } from "@/lib/server/data";
import { PAPER, themeScript } from "@/lib/theme";
import "./globals.css";

const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
});

const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin", "latin-ext"],
  variable: "--font-atkinson",
  adjustFontFallback: false,
});

const mono = Atkinson_Hyperlegible_Mono({
  subsets: ["latin"],
  variable: "--font-atkinson-mono",
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: { default: "Thread", template: "%s · Thread" },
  description: "Keep someone’s stories in their own voice.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: PAPER.light },
    { media: "(prefers-color-scheme: dark)", color: PAPER.dark },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const vault = await loadVault();
  return (
    <html lang="en" suppressHydrationWarning className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        <Script id="theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        <a
          href="#main"
          className="fixed top-3 left-3 z-50 -translate-y-24 rounded-full bg-ink px-5 py-3 text-paper transition-transform focus:translate-y-0"
        >
          {t.skipToContent}
        </a>
        <AudioProvider subject={vault?.subject ?? null}>
          {children}
          <MiniPlayer />
        </AudioProvider>
      </body>
    </html>
  );
}

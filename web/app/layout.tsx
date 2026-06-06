import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, RocknRoll_One } from "next/font/google";

import { EasterEggProvider } from "@/app/components/eastereggs/EasterEggProvider";
import { Header } from "@/app/components/Header";
import { AuthProvider } from "@/lib/auth-context";
import "@/app/globals.css";

// Chunky display face for the wordmark / score numbers.
const display = RocknRoll_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

// Body / UI typeface — Japanese-first.
const sans = Noto_Sans_JP({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Black Thunder ⚡ ザクザク開発エコシステム",
    template: "%s",
  },
  description:
    "ターミナルからエディタ、ブラウザ、メニューバーまで。AIザクザク度（AI利用で消費したブラックサンダーの本数）とブラックサンダーカウントをリアルタイムで競う、ザクザク開発のエコシステム。⚡BTDD。",
  applicationName: "Black Thunder",
  openGraph: {
    title: "Black Thunder ⚡ ザクザク開発エコシステム",
    description:
      "AIザクザク度とブラックサンダーカウントをリアルタイムで競う、ザクザク開発のエコシステム。⚡BTDD。",
    type: "website",
  },
  icons: {
    icon: "/assets/product/bar-piece.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <Header />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6 sm:px-6">
            {children}
          </main>
          <EasterEggProvider />
        </AuthProvider>
      </body>
    </html>
  );
}

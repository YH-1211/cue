import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { BottomNav } from "@/components/bottom-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Cue — 行きたいが、見つかる。",
    template: "%s | Cue",
  },
  description:
    "アート・音楽・舞台・祭り・季節のイベントを、まとめてチェック。気になる予定を見つけて、保存できるイベント発見アプリ。",
  applicationName: "Cue",
  appleWebApp: {
    capable: true,
    title: "Cue",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans pb-[calc(env(safe-area-inset-bottom)+56px)] sm:pb-0">
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}

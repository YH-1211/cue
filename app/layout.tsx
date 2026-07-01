import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { PWAInstallBanner } from "@/components/pwa-install-banner";
import { SITE } from "@/lib/site";
import { createClient } from "@/utils/supabase/server";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "アート・音楽・舞台・祭り・季節のイベントを、まとめてチェック。気になる予定を見つけて、保存できるイベント発見アプリ。";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Cue — 行きたいが、見つかる。",
    template: "%s | Cue",
  },
  description: DESCRIPTION,
  applicationName: "Cue",
  appleWebApp: {
    capable: true,
    title: "Cue",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "Cue",
    locale: "ja_JP",
    title: "Cue — 行きたいが、見つかる。",
    description: DESCRIPTION,
    url: "/",
    images: [{ url: "/api/og", width: 1200, height: 630, alt: "Cue" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cue — 行きたいが、見つかる。",
    description: DESCRIPTION,
    images: ["/api/og"],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0F" },
  ],
};

// 描画前に同期実行してテーマ/アクセント色を確定させ、チラつき (FOUC) を防ぐ。
// ログインユーザーは DB の値 (serverTheme/serverAccent) を最優先で適用し、
// localStorage にも同期する (別端末で初ログインしても一発で見た目が揃う)。
// ゲストや未保存ユーザーは localStorage → 端末設定の順でフォールバックする。
function buildThemeInit(
  serverTheme: string | null,
  serverAccent: string | null
) {
  const st = JSON.stringify(serverTheme);
  const sa = JSON.stringify(serverAccent);
  return `(function(){try{var e=document.documentElement;var st=${st};var sa=${sa};if(st){if(st==='system'){localStorage.removeItem('cue:theme');}else{localStorage.setItem('cue:theme',st);}}if(sa){localStorage.setItem('cue:accent',sa);}var t=st==='system'?null:(st||localStorage.getItem('cue:theme'));if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}e.classList.toggle('dark',t==='dark');e.style.colorScheme=t;var a=sa||localStorage.getItem('cue:accent');if(['violet','orange','blue','teal','pink','green'].indexOf(a)<0)a='violet';e.setAttribute('data-accent',a);}catch(e){}})();`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // ログインユーザーの保存済み表示設定を取得 (未適用 migration でも壊れないよう握りつぶす)。
  let serverTheme: string | null = null;
  let serverAccent: string | null = null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("theme, accent")
      .eq("id", user.id)
      .maybeSingle();
    if (typeof data?.theme === "string") serverTheme = data.theme;
    if (typeof data?.accent === "string") serverAccent = data.accent;
  }

  return (
    <html
      lang="ja"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: buildThemeInit(serverTheme, serverAccent),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col overflow-x-clip bg-background text-foreground font-sans pb-[calc(env(safe-area-inset-bottom)+64px)] sm:pb-0">
        <Header />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
        <BottomNav />
        <ServiceWorkerRegister />
        <PWAInstallBanner />
      </body>
    </html>
  );
}

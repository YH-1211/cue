import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cue — 行きたいが、見つかる。",
    short_name: "Cue",
    description:
      "アート・音楽・舞台・祭り・季節のイベントを、まとめてチェック。気になる予定を見つけて、保存できるイベント発見アプリ。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0F",
    theme_color: "#0A0A0F",
    lang: "ja",
    categories: ["lifestyle", "entertainment", "events"],
    shortcuts: [
      {
        name: "イベントを見る",
        short_name: "イベント",
        url: "/events",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "投稿する",
        short_name: "投稿",
        url: "/events/new",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

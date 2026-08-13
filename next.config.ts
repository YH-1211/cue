import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker(standalone) デプロイ用。必要ファイルだけをまとめて出力する。
  // Vercel でもそのまま動くので付けたままで問題ない。
  output: "standalone",
  images: {
    // 自前アップロードのレポート写真 (Supabase Storage の公開バケット) のみを
    // next/image の最適化対象として許可する。外部ドメインは開けない。
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pvhjchkodntjtqxyqlqs.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/event-reports/**",
        search: "",
      },
    ],
  },
  experimental: {
    serverActions: {
      // 写真アップロード (最大 6 枚 × 5MB = 30MB) を許容
      bodySizeLimit: "35mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker(standalone) デプロイ用。必要ファイルだけをまとめて出力する。
  // Vercel でもそのまま動くので付けたままで問題ない。
  output: "standalone",
  experimental: {
    serverActions: {
      // 写真アップロード (最大 6 枚 × 5MB = 30MB) を許容
      bodySizeLimit: "35mb",
    },
  },
};

export default nextConfig;

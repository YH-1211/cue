import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 写真アップロード (最大 6 枚 × 5MB = 30MB) を許容
      bodySizeLimit: "35mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "d226b0iufwcjmj.cloudfront.net" },
      { protocol: "https", hostname: "images.shufersal.co.il" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;

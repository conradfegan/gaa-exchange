import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://dfumaftmsshfxoppoiby.supabase.co/**"),
      new URL("https://images.unsplash.com/**"),
      new URL("https://picsum.photos/**"),
    ],
  },
};

export default nextConfig;

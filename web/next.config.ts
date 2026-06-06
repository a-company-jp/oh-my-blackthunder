import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a minimal self-contained server bundle (.next/standalone/server.js)
  // for the Cloud Run container image.
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // GitHub avatars rendered on the leaderboard / profiles.
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;

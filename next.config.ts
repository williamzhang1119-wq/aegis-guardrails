import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is what the Railway Dockerfile copies into the runner
  // image. Skip it on Vercel: Next 16.3 + `output: "standalone"` fails in
  // onBuildComplete with ENOENT .next/next-server.js.nft.json (vercel/next.js#96646).
  // Vercel sets VERCEL=1; Docker / Railway / Render do not, so they keep standalone.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Next blocks cross-origin requests to dev-only resources (HMR, /_next/*) by
  // default. This app is previewed through a proxy whose hostname differs from
  // the bind address, so those requests need to be allowed or the page loads
  // without styles and never reconnects. Dev-server only — no effect on a build.
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "172.30.0.2",
    "172.17.0.1",
    "*.cursor.sh",
    "*.cursor.com",
  ],
};

export default nextConfig;

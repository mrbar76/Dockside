import type { NextConfig } from "next";

// Every page here is per-member and read at request time, so the app uses plain
// dynamic rendering. Cache Components can be switched on later, route by route.
const nextConfig: NextConfig = {
  cacheComponents: false,
  serverExternalPackages: ["pg", "nodemailer", "web-push"],
  // Uploads go through server actions. Vercel caps a request at 4.5 MB, so
  // files are held to 4 MB (checked again in the upload action).
  experimental: { serverActions: { bodySizeLimit: "4.4mb" } },
  images: { localPatterns: [{ pathname: "/*/files/**" }] },
};

export default nextConfig;

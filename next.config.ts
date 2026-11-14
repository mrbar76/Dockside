import type { NextConfig } from "next";

// Every page here is per-member and read at request time, so the app uses plain
// dynamic rendering. Cache Components can be switched on later, route by route.
const nextConfig: NextConfig = {
  cacheComponents: false,
  serverExternalPackages: ["pg", "nodemailer", "web-push"],
};

export default nextConfig;

import type { NextConfig } from "next"
import path from "node:path"
import { loadEnvFile } from "@iris/shared"

loadEnvFile(path.join(process.cwd(), "../../.env"))

const nextConfig: NextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@iris/shared", "@iris/db"],
  serverExternalPackages: ["postgres", "ioredis", "drizzle-orm"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
}

export default nextConfig

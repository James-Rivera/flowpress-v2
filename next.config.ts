import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
};

export default nextConfig;

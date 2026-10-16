import type { NextConfig } from "next";

const netlify = process.env.CHANGBAN_BACKEND === "netlify" || process.env.NETLIFY === "true";
const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["@netlify/database"],
  webpack(config, { webpack }) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\/db\/runtime$/, process.cwd() + (netlify ? '/db/netlify-runtime.ts' : '/db/local-runtime.ts')));
    return config;
  },
};

export default nextConfig;

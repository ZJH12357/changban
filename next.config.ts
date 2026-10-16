import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  webpack(config, { webpack }) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\/db\/runtime$/, process.cwd() + '/db/local-runtime.ts'));
    return config;
  },
};

export default nextConfig;

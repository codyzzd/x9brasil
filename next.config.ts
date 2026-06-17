import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  staticPageGenerationTimeout: 300,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.camara.leg.br",
        pathname: "/internet/deputado/bandep/**",
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const privateNetworkDevOrigins = [
  "10.*.*.*",
  "192.168.*.*",
  ...Array.from({ length: 16 }, (_, index) => `172.${16 + index}.*.*`),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: privateNetworkDevOrigins,
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

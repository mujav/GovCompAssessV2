import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer, webpack }) => {
    // pptxgenjs reaches for node:fs and node:https only when it runs under Node; the browser
    // build never takes that path, so leave those modules out of it.
    if (!isServer) config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^node:(fs|https)$/, contextRegExp: /pptxgenjs/ }));
    return config;
  },
};

export default nextConfig;

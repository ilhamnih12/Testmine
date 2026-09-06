/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // WASM + COOP/COEP require same-origin static assets without cross-origin fetch.
  // Keep everything on this origin; a separate server is only used for UDP-over-WebSocket networking.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Large .wasm / .data assets are served from /public as static files, so this
  // is only needed if we ever dynamically import them in app code.
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, topLevelAwait: true };
    return config;
  },
};

export default nextConfig;

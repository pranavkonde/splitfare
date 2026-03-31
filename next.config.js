const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/storacha\.link\/ipfs\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'ipfs-content',
        expiration: {
          maxEntries: 500,
          maxAgeSeconds: 365 * 24 * 60 * 60, 
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      urlPattern: /^\/api\/users\/me.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /^\/api\/.*/i,
      handler: 'NetworkOnly',
    },
    {
      urlPattern: /\.(?:js|css|woff2?|png|svg|jpg|jpeg|gif|webp)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, 
        },
      },
    },
  ],
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storacha.link',
        pathname: '/ipfs/**',
      },
    ],
  },
};

module.exports = withPWA(nextConfig);

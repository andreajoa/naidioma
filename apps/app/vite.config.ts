import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-192.png',
        'icon-maskable-512.png',
        'og-naidioma.png',
        'push-sw.js',
      ],
      manifest: {
        id: '/',
        name: 'NAidioma — Aprenda Idiomas Brincando',
        short_name: 'NAidioma',
        description:
          'Aprenda Inglês (A1 ao C2), Coreano, Japonês e mais 5 idiomas com trilha completa, chamada ao vivo com IA e modo offline.',
        theme_color: '#C12B5B',
        background_color: '#FFF9F0',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        prefer_related_applications: false,
        categories: ['education'],
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        importScripts: ['/push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/robots\.txt$/,
          /^\/sitemap\.xml$/,
          /^\/llms(?:-full)?\.txt$/,
          /^\/(?:pt-br|en-us|en-ca|en-au|en-nz|ingles-a1-c2|chamada-ao-vivo-ia)(?:\/|$)/,
        ],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/courses'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'naidioma-courses-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/review'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'naidioma-review-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
      },
    },
  },
});

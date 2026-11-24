/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png', '.nojekyll'],
      manifest: {
        id: './',
        name: 'FitCore – Ernährung, Training, Körper',
        short_name: 'FitCore',
        description: 'Local-first Fitness-, Ernährungs- und Körperanalyse-App',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['health', 'fitness', 'food'],
        background_color: '#0e0809',
        theme_color: '#0e0809',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,webp,jpg,woff2}'],
        // Boss- und Rüstungsbilder nicht vorab laden (nur Getragenes/Aktuelles wird gebraucht) – beim ersten Anzeigen offline gespeichert
        globIgnores: ['**/boss_*', '**/ruestung_*'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/ruestung_[^/]+\.webp$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'fitcore-ruestung', expiration: { maxEntries: 300 } },
          },
          {
            urlPattern: ({ url }) => /\/assets\/boss_[^/]+\.(webp|png|jpe?g)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'fitcore-bosse', expiration: { maxEntries: 30 } },
          },
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    // Spielgrafiken nie als base64 ins JS packen – sie werden bei Bedarf geladen und einzeln gecacht
    assetsInlineLimit: (file) => (file.includes('/assets/rpg/') ? false : undefined),
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          data: ['dexie', 'dexie-react-hooks', 'zod', 'zustand', '@tanstack/react-query'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/live/**', 'node_modules/**'],
  },
});

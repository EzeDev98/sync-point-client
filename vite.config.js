import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api/],
        },
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'masked-icon.svg'
        ],
      manifest: {
        name: 'SyncPoint',
        short_name: 'SyncPoint',
        description: 'Offline first peer-to-peer payment app',
        theme_color: '#0F766E',
        background_color: '#FFFFFF',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
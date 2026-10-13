import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import theme from './data/theme/godot-4.7-defaults.json' with { type: 'json' };

const baseColor = theme.interface.base_color;

export default defineConfig({
  base: '/godot-vocabulary/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['app-icon.svg', 'fonts/*', 'icons/*.svg'],
      manifest: {
        name: 'Godot Vocabulary',
        short_name: 'GodotVocab',
        description: 'Four-choice drills for Godot 4.7 API, GDScript and Git/GitHub vocabulary. Unofficial community project.',
        display: 'standalone',
        start_url: '/godot-vocabulary/',
        scope: '/godot-vocabulary/',
        theme_color: baseColor,
        background_color: baseColor,
        icons: [
          { src: 'app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
});

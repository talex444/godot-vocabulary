import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import theme from './data/theme/godot-4.7-defaults.json' with { type: 'json' };

const baseColor = theme.interface.base_color;

// `vite build --mode android` (pnpm build:android) builds for the Capacitor package: its WebView serves
// the files from the root, so paths are relative, and the package needs no service worker or web manifest.
export default defineConfig(({ mode }) => {
  const android = mode === 'android';
  return {
    base: android ? './' : '/godot-vocabulary/',
    plugins: [
      VitePWA({
        disable: android,
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
          globPatterns: ['**/*.{js,css,html,json,svg,png,webp,woff2}'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        },
      }),
    ],
  };
});

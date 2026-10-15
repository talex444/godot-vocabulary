import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
// The app opens on the home page, so the installed app's bars and splash wear its base colour
// (src/theme/home.ts, grey 0; tests/unit/tokens.test.ts keeps the two equal).
export const HOME_BASE_COLOR = '#130e09';
const baseColor = HOME_BASE_COLOR;

// `vite build --mode android` (pnpm build:android) builds for the Capacitor package: its WebView serves
// the files from the root, so paths are relative, and the package needs no service worker or web manifest.
export default defineConfig(({ mode }) => {
  const android = mode === 'android';
  return {
    base: android ? './' : '/godot-vocabulary/',
    // dist/.vite/manifest.json: the chunk graph scripts/check-budget.mjs follows (decision 55).
    build: { manifest: true },
    plugins: [
      VitePWA({
        disable: android,
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['app-icon.svg', 'fonts/*', 'icons/*.svg'],
        manifest: {
          name: 'Godot Vocabulary',
          short_name: 'GodotVocab',
          description: 'Four-choice drills in two areas: Godot (the 4.7 API and GDScript) and Git & GitHub. Unofficial community project.',
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
          globPatterns: ['**/*.{js,css,html,json,svg,png,webp,gif,woff2}'],
          maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        },
      }),
    ],
  };
});

/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from '@capacitor/cli';
import theme from './data/theme/godot-4.7-defaults.json' with { type: 'json' };

/** The Android package (decision 25): the same web build, served from the package root (`pnpm build:android`). */
const config: CapacitorConfig = {
  appId: 'io.github.talex444.godotvocabulary',
  appName: 'Godot Vocabulary',
  webDir: 'dist',
  backgroundColor: theme.interface.base_color,
  plugins: {
    LocalNotifications: {
      // android/app/src/main/res/drawable/ic_stat_reminder.xml: the app glyph's tick, white on transparent.
      smallIcon: 'ic_stat_reminder',
      iconColor: theme.interface.accent_color,
    },
  },
};

export default config;

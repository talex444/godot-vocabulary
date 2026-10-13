import { registerPlugin } from '@capacitor/core';

/**
 * Export inside the Android package: the WebView cannot download a blob, so the text goes to the
 * app's own plugin (`android/…/SaveFilePlugin.java`), which opens Android's "Save as" screen.
 * Loaded with `import()` only inside the package.
 */

interface SaveFile {
  save(options: { name: string; text: string }): Promise<{ saved: boolean }>;
}

const plugin = registerPlugin<SaveFile>('SaveFile');

/** True when the learner picked a place and the file was written; false when they cancelled. */
export async function saveFile(name: string, text: string): Promise<boolean> {
  return (await plugin.save({ name, text })).saved;
}

import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';

// Decision 49: the reminder opens the home page. A cold start opens there anyway; a tap while the app
// runs calls back to it. Capacitor's plugin is replaced by a stand-in that records the listener.

const listeners = new Map<string, (action: { notification: { id: number } }) => void>();

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    addListener: async (event: string, fn: (action: { notification: { id: number } }) => void) => {
      listeners.set(event, fn);
      return { remove: async () => undefined };
    },
    cancel: async () => undefined,
    checkPermissions: async () => ({ display: 'denied' }),
  },
}));

vi.stubGlobal('document', { addEventListener: () => undefined, visibilityState: 'visible' });

describe('the reminder’s tap', () => {
  it('opens the home page', async () => {
    const { restoreReminder } = await import('../../src/reminder/native');
    const openHome = vi.fn();
    await restoreReminder(openHome);
    const tapped = listeners.get('localNotificationActionPerformed');
    expect(tapped).toBeDefined();
    tapped!({ notification: { id: 7 } });
    expect(openHome).not.toHaveBeenCalled();
    tapped!({ notification: { id: 1 } });
    expect(openHome).toHaveBeenCalledOnce();
  });
});

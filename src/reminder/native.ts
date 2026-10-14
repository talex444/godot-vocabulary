import { LocalNotifications } from '@capacitor/local-notifications';
import { AREAS } from '../areas/registry';
import { load } from '../session/run';
import { deviceDeps } from '../session/deck';
import { getReminder, type ReminderSetting } from '../store/db';
import { cardsWaiting, nextFire, parseTime, reminderTitle } from './reminder';

/**
 * Capacitor calls for the daily reminder. Loaded only inside the Android package (`isNativeApp()`),
 * so the web build never runs it.
 */

const REMINDER_ID = 1;

export type PermissionResult = 'granted' | 'denied';

/** Asks for the notification permission when Android has not been asked yet (Android 13+); otherwise reports it. */
export async function askNotificationPermission(): Promise<PermissionResult> {
  let { display } = await LocalNotifications.checkPermissions();
  if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await LocalNotifications.requestPermissions());
  return display === 'granted' ? 'granted' : 'denied';
}

/** Whether Android lets this app set exact alarms ("Alarms & reminders"). */
export async function exactAllowed(): Promise<boolean> {
  return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
}

/** Opens Android's exact-alarm setting for this app; resolves with the setting when the learner comes back. */
export async function openExactSetting(): Promise<boolean> {
  return (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted';
}

/**
 * Cancels the reminder, then, when it is on and notifications are allowed, schedules it again: one
 * repeating notification at the chosen hour and minute. Exact only when Android allows exact alarms;
 * otherwise inexact (`isExactNotification: false`, so scheduling never opens the exact-alarm screen).
 * The count is the cards waiting at the next firing; tapping the notification opens the app.
 */
export async function applyReminder(reminder: ReminderSetting): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  const time = parseTime(reminder.time);
  if (!reminder.on || !time) return;
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  let count: number | undefined;
  try {
    const areas = await Promise.all(AREAS.map((area) => load(deviceDeps, area.id)));
    count = cardsWaiting(areas, nextFire(time, new Date()));
  } catch {
    count = undefined;
  }
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: reminderTitle(count),
        body: 'Due reviews and today’s new cards. Tap to open.',
        schedule: { on: { hour: time.hour, minute: time.minute }, allowWhileIdle: true },
        isExactNotification: await exactAllowed(),
      },
    ],
  });
}

/**
 * On launch: re-schedule from the saved setting (so a reboot, an update or a changed exact-alarm
 * setting never leaves a stale alarm), and again whenever the app goes to the background, so the
 * count follows the session just finished.
 */
export async function restoreReminder(): Promise<void> {
  const refresh = async () => applyReminder(await getReminder()).catch(() => undefined);
  await refresh();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void refresh();
  });
}

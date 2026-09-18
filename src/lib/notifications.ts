// Local (on-device) notification scheduling for date-based reminders.
// Odometer-based reminders can't be scheduled ahead of time — they're
// surfaced via the in-app "overdue/upcoming" status instead, computed
// against the vehicle's latest logged fill-up odometer.
//
// IMPORTANT: expo-notifications must be imported lazily (dynamic import,
// inside each function below), never at module top level. Expo Go on SDK 53+
// removed remote-push support, and the package throws on import there (not
// just when a push-specific API is called) — since MaintenanceScreen /
// AddReminderScreen import this file, a top-level `import * as Notifications`
// here previously crashed the ENTIRE app on every launch in Expo Go, not just
// when scheduling a reminder. A dynamic import confines the failure to the
// one action that needs it, and every function here already treats "can't
// schedule" as a silent no-op — reminders still work, just without an OS
// notification, until run from a real EAS dev/production build.
import { Platform } from 'react-native';
import { isExpoGo } from './platform';

let handlerReady = false;
async function loadNotifications() {
  const Notifications = await import('expo-notifications');
  if (!handlerReady) {
    handlerReady = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  }
  return Notifications;
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (isExpoGo) return false;
  try {
    const Notifications = await loadNotifications();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

/** Schedules a reminder notification for 9am on the given ISO date. Silently no-ops on failure. */
export async function scheduleDueDateNotification(params: {
  reminderId: string;
  title: string;
  dueDateISO: string;
}): Promise<string | null> {
  if (isExpoGo) return null;
  try {
    const Notifications = await loadNotifications();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('maintenance-reminders', {
        name: 'Maintenance reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    const granted = await ensureNotificationPermission();
    if (!granted) return null;

    const due = new Date(params.dueDateISO + 'T09:00:00');
    if (due.getTime() <= Date.now()) return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Vehicle maintenance due',
        body: params.title,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: due },
      identifier: params.reminderId,
    });
  } catch {
    return null;
  }
}

export async function cancelNotification(id: string): Promise<void> {
  if (isExpoGo) return;
  try {
    const Notifications = await loadNotifications();
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignore */
  }
}

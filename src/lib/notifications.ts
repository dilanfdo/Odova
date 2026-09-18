// Local (on-device) notification scheduling for date-based reminders.
// Odometer-based reminders can't be scheduled ahead of time — they're
// surfaced via the in-app "overdue/upcoming" status instead, computed
// against the vehicle's latest logged fill-up odometer.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
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
  try {
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
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    /* ignore */
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';

export type DueType = 'date' | 'odometer';

export interface Reminder {
  id: string;
  vehicleId: string;
  title: string;
  dueType: DueType;
  dueDate: string | null; // ISO date, set when dueType === 'date'
  dueOdometer: number | null; // km, set when dueType === 'odometer'
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
}

const KEY_PREFIX = 'odova_reminders_';

export async function getReminders(vehicleId: string): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + vehicleId);
    return raw ? (JSON.parse(raw) as Reminder[]) : [];
  } catch {
    return [];
  }
}

async function saveReminders(vehicleId: string, reminders: Reminder[]): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + vehicleId, JSON.stringify(reminders));
}

export async function addReminder(
  vehicleId: string,
  input: { title: string; dueType: DueType; dueDate: string | null; dueOdometer: number | null; notes: string }
): Promise<Reminder> {
  const reminder: Reminder = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    vehicleId,
    title: input.title.trim(),
    dueType: input.dueType,
    dueDate: input.dueType === 'date' ? input.dueDate : null,
    dueOdometer: input.dueType === 'odometer' ? input.dueOdometer : null,
    notes: input.notes.trim() || null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  const existing = await getReminders(vehicleId);
  await saveReminders(vehicleId, [...existing, reminder]);
  return reminder;
}

export async function deleteReminder(vehicleId: string, id: string): Promise<void> {
  const existing = await getReminders(vehicleId);
  await saveReminders(vehicleId, existing.filter((r) => r.id !== id));
}

export async function completeReminder(vehicleId: string, id: string): Promise<void> {
  const existing = await getReminders(vehicleId);
  await saveReminders(
    vehicleId,
    existing.map((r) => (r.id === id ? { ...r, completedAt: new Date().toISOString() } : r))
  );
}

/** Status relative to today's date and the vehicle's last known odometer reading. */
export function reminderStatus(
  r: Reminder,
  currentOdometer: number | null
): 'done' | 'overdue' | 'upcoming' | 'ok' {
  if (r.completedAt) return 'done';
  if (r.dueType === 'date' && r.dueDate) {
    const days = (new Date(r.dueDate).getTime() - Date.now()) / 86_400_000;
    if (days < 0) return 'overdue';
    if (days <= 14) return 'upcoming';
    return 'ok';
  }
  if (r.dueType === 'odometer' && r.dueOdometer !== null && currentOdometer !== null) {
    const remaining = r.dueOdometer - currentOdometer;
    if (remaining < 0) return 'overdue';
    if (remaining <= 500) return 'upcoming';
    return 'ok';
  }
  return 'ok';
}

// Maintenance reminder type + pure status helper. CRUD lives in api.ts and
// GarageContext (server-synced via /api/fuel, mirroring vehicles/fills) —
// this file used to own local AsyncStorage persistence directly, but
// reminders never followed a garage across devices that way. See
// docs/architecture.md in the repo root for the migration note.

export type DueType = 'date' | 'odometer';

export interface Reminder {
  id: string;
  vehicle_id: string;
  title: string;
  due_type: DueType;
  due_date: string | null; // ISO date, set when due_type === 'date'
  due_odometer: number | null; // km, set when due_type === 'odometer'
  notes: string | null;
  completed_at: string | null;
  /** At most one of these is set — see GarageContext.completeReminder for
   * how the next occurrence gets created when one of these fires. */
  recurrence_interval_days: number | null;
  recurrence_interval_km: number | null;
  created_at: string;
}

/** Status relative to today's date and the vehicle's last known odometer reading. */
export function reminderStatus(
  r: Reminder,
  currentOdometer: number | null
): 'done' | 'overdue' | 'upcoming' | 'ok' {
  if (r.completed_at) return 'done';
  if (r.due_type === 'date' && r.due_date) {
    const days = (new Date(r.due_date).getTime() - Date.now()) / 86_400_000;
    if (days < 0) return 'overdue';
    if (days <= 14) return 'upcoming';
    return 'ok';
  }
  if (r.due_type === 'odometer' && r.due_odometer !== null && currentOdometer !== null) {
    const remaining = r.due_odometer - currentOdometer;
    if (remaining < 0) return 'overdue';
    if (remaining <= 500) return 'upcoming';
    return 'ok';
  }
  return 'ok';
}

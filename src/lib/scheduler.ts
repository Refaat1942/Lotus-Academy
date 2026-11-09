import { log } from "./log";
import { claimReminder, runReminders } from "./reminders";

const HOUR = 3600_000;
let started = false;

/** Runs the reminder job hourly. A per-hour key in ReminderLog keeps it to one run per hour even with several replicas. */
export function startScheduler() {
  if (started) return;
  started = true;
  const tick = async () => {
    try {
      const slot = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
      if (!(await claimReminder(`run:${slot}`, "system"))) return;
      await runReminders();
    } catch (e) {
      log("error", "reminders.failed", { error: e instanceof Error ? e.message : String(e) });
    }
  };
  setTimeout(tick, 2 * 60_000);
  setInterval(tick, HOUR).unref?.();
}

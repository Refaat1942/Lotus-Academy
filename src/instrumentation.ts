/** Starts the hourly reminder scheduler in the production Node.js server (disable with REMINDERS_DISABLED=1). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production" || process.env.REMINDERS_DISABLED === "1") return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}

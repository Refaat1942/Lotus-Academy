/** Starts the hourly reminder scheduler in the production Node.js server (disable with REMINDERS_DISABLED=1). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production" || process.env.REMINDERS_DISABLED === "1") return;
  // Never during `next build` (page-data workers also load instrumentation) — a pending timer would keep them alive.
  if (process.env.NEXT_PHASE === "phase-production-build" || process.argv.some((a) => a === "build")) return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}

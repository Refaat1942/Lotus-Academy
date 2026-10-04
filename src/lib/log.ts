type Level = "info" | "warn" | "error";
export function log(level: Level, event: string, data: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
  (level === "error" ? console.error : console.log)(line);
}

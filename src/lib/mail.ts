import nodemailer from "nodemailer";
import { db } from "./db";
import { env } from "./env";
import { log } from "./log";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type Template =
  | "welcome" | "email_verification" | "password_reset" | "enrollment_confirmation"
  | "course_completion" | "certificate_ready" | "admin_notification" | "course_update";

/** Branded HTML shell shared by every transactional email. */
function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f8f9fa;font-family:Segoe UI,Arial,sans-serif;color:#161e26">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e0e4e8;border-radius:8px">
<tr><td style="background:#0e5e57;color:#fff;padding:20px 28px;font-size:18px;font-weight:600">LOTUS ACADEMY &nbsp;<span style="font-weight:400;font-size:13px;opacity:.85">أكاديمية لوتس</span></td></tr>
<tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${bodyHtml}
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#0e5e57;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">${esc(cta.label)}</a></p><p style="font-size:12px;color:#64707a">${esc(cta.url)}</p>` : ""}
</td></tr><tr><td style="padding:16px 28px;font-size:12px;color:#64707a;border-top:1px solid #e0e4e8">Lotus Academy — Pharmacy Education &amp; Professional Development</td></tr>
</table></td></tr></table></body></html>`;
}

export function render(template: Template, p: Record<string, string>): { subject: string; html: string } {
  const name = esc(p.name ?? "");
  switch (template) {
    case "welcome":
      return { subject: "Welcome to Lotus Academy", html: layout("Welcome to Lotus Academy", `<p>Hello ${name}, your account is ready.</p>`, { label: "Browse courses", url: `${env.appUrl()}/courses` }) };
    case "email_verification":
      return { subject: "Verify your email — Lotus Academy", html: layout("Verify your email", `<p>Hello ${name}, confirm your email address to activate your account. The link expires in 24 hours and can be used once.</p>`, { label: "Verify email", url: p.url }) };
    case "password_reset":
      return { subject: "Reset your password — Lotus Academy", html: layout("Reset your password", `<p>Hello ${name}, we received a request to reset your password. The link expires in 1 hour and can be used once. If this wasn't you, ignore this email.</p>`, { label: "Reset password", url: p.url }) };
    case "enrollment_confirmation":
      return { subject: `Enrolled: ${p.course}`, html: layout("You're enrolled", `<p>Hello ${name}, you are now enrolled in <strong>${esc(p.course ?? "")}</strong>.</p>`, { label: "Start learning", url: p.url }) };
    case "course_completion":
      return { subject: `Course completed: ${p.course}`, html: layout("Congratulations!", `<p>Hello ${name}, you completed <strong>${esc(p.course ?? "")}</strong>.</p>`, { label: "View dashboard", url: p.url }) };
    case "certificate_ready":
      return { subject: `Your certificate: ${p.course}`, html: layout("Your certificate is ready", `<p>Hello ${name}, your certificate for <strong>${esc(p.course ?? "")}</strong> is ready (ID ${esc(p.certificateId ?? "")}).</p>`, { label: "View certificate", url: p.url }) };
    case "course_update":
      return { subject: `Course updated: ${p.course}`, html: layout("A course you follow was updated", `<p>${esc(p.course ?? "")} has new content.</p>`, { label: "Open course", url: p.url }) };
    default:
      return { subject: p.subject ?? "Notification", html: layout(p.subject ?? "Notification", `<p>${esc(p.message ?? "")}</p>`) };
  }
}

/** Sends (or, if SMTP isn't configured, only logs) a transactional email. Never throws. */
export async function sendMail(to: string, template: Template, params: Record<string, string>) {
  const { subject, html } = render(template, params);
  const cfg = env.smtp();
  const rec = await db.emailLog.create({ data: { recipient: to, template, subject, provider: cfg.host ? "smtp" : "log-only" } });
  if (!cfg.host) {
    await db.emailLog.update({ where: { id: rec.id }, data: { status: "FAILED", error: "SMTP not configured (SMTP_HOST unset)" } });
    log("warn", "email.not_sent", { template, to });
    return false;
  }
  try {
    const transport = nodemailer.createTransport({ host: cfg.host, port: cfg.port, secure: cfg.port === 465, auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined });
    await transport.sendMail({ from: cfg.from, to, subject, html });
    await db.emailLog.update({ where: { id: rec.id }, data: { status: "SENT", sentAt: new Date() } });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.emailLog.update({ where: { id: rec.id }, data: { status: "FAILED", error: msg.slice(0, 500), retryCount: { increment: 1 } } });
    log("error", "email.failed", { template, error: msg });
    return false;
  }
}

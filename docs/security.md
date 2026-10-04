# Security

Controls: bcrypt hashing; hashed session/one-time tokens; HttpOnly/SameSite/Secure cookies; RBAC enforced server-side on every page, action and API;
progress, enrollment and quiz grading computed server-side (client input only selects option IDs, forged IDs are ignored);
Zod validation; Prisma parameterised queries; Markdown sanitized by allow-list (no scripts/iframes/images/event handlers);
CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS; DB-backed rate limits + lockout; generic auth errors;
owner-only certificate/quiz-result pages; public verification via unguessable ID with rate limit; CSV formula-injection escaping;
ZIP importer path-traversal/size/type guards; audit log for admin actions; structured JSON logs; unhandled errors show a generic page.

Known limitations / follow-ups: CSP allows `'unsafe-inline'` scripts/styles (Next.js inline bootstrap; move to nonces later);
rate limiting keys on `X-Real-IP` (set by Nginx); no 2FA yet; no virus scanning (no user file uploads exist yet — add before enabling attachments);
admin-entered video URLs are https-only but not allow-listed by host.

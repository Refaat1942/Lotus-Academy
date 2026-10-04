# Authentication

* Passwords: bcrypt (cost 12), min 10 chars with letters+digits; never logged or stored in plaintext.
* Sessions: random 256-bit token in an `HttpOnly; SameSite=Lax; Secure` (when `APP_URL` is https) cookie `la_session`; only its SHA-256 is stored; 14-day expiry.
* Registration → `PENDING` account + email-verification token (24 h, single use). Login is refused until verified.
  Registration responds identically for existing emails (no enumeration).
* Verification links open a page requiring an explicit click (POST), so mail scanners can't consume the one-time token.
* Password reset: 1 h single-use token; using it invalidates all sessions and other tokens. "Forgot" always returns the same message.
* Lockout: 5 failed logins → 15 min lock. Rate limits (PostgreSQL-backed): login per IP/email, register, resend, forgot, certificate verification.
* CSRF: server actions are same-origin checked by Next.js (Nginx must forward `Host`/`X-Forwarded-Host`) plus SameSite cookies.
* Open redirect: `next` must start with a single `/`.

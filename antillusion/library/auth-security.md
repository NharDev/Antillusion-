# Authentication, authorisation and application security
tags: auth login password session jwt oauth security owasp xss csrf sql injection cors hashing secrets encryption تسجيل دخول حسابات كلمه مرور امان حمايه

Passwords: hash with Argon2id (or bcrypt cost ≥ 12); never store or log plaintext; constant-time compare; rate-limit and lock out on login; generic error ("invalid email or password"). Prefer passkeys/WebAuthn or OAuth (Google/GitHub) when it fits. Use a maintained library (better-auth, Auth.js, django-allauth, fastapi-users, Devise) rather than hand-rolling flows.

Sessions vs tokens: server-side session id in a cookie (`HttpOnly; Secure; SameSite=Lax; Path=/`) is the safe default for web apps. JWTs suit service-to-service and mobile: short-lived access token (≈15 min) + rotating refresh token stored HttpOnly; verify signature, `exp`, `aud`, `iss`; fix the algorithm; never put secrets in the payload; never keep tokens in localStorage for sites with any XSS surface.

Authorisation: check on the server on every request, per object ("does this user own row 42?") — not just "is logged in". Centralise policies; deny by default.

OWASP essentials:
- Injection: parameterised SQL; no shell strings from input (`execFile` with an args array); validate with schemas.
- XSS: escape output by default (frameworks do); sanitise any HTML with DOMPurify; Content-Security-Policy without `unsafe-inline`.
- CSRF: SameSite cookies + CSRF token for cookie-auth state-changing requests; check Origin.
- SSRF: allow-list outbound hosts, block private ranges when fetching user-supplied URLs.
- Access control / IDOR: never trust ids from the client without an ownership check.
- Secrets: env vars or a secret manager; `.env` git-ignored with a committed `.env.example`; rotate anything that leaked.
- Uploads: limit size and type (sniff, don't trust the extension), store outside the web root or in object storage, random names.
- Transport: HTTPS everywhere, HSTS; security headers (helmet).
- Dependencies: lockfile committed; `npm audit` / `pip-audit`; minimal privileges for db users and tokens.
- Crypto: use the platform (`crypto.subtle`, libsodium, `cryptography`) — AES-GCM with random nonce, never invent schemes; random ids from a CSPRNG (`crypto.randomUUID()`, `secrets.token_urlsafe()`).
- Logging: never log passwords, tokens or full card/ID numbers.

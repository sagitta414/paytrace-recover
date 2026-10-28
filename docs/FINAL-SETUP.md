# Final setup and handoff

This build includes the requested application safeguards. External services are activated through server configuration; no provider account, credential or real learner record was supplied during development. Do not interpret the automated test suite as live business acceptance.

## Run and review

Use Node 24 or newer:

```
npm ci
npm test
npm start
```

Default backend: `http://127.0.0.1:4358`. Recovery Center: `/recovery.html`; merchant account: `/account.html`; Operations shows job state, database checks, backup restore probes and provider setup. The current local review server is on 4361. The older static simulation remains available using `node serve.cjs` on 4357; it does not operate the backend features.

The application binds to loopback by default in development. Set HOST explicitly for a hosted service. Configure PUBLIC_URL and PORT together. Source files include `.env.example`; real `.env`, databases, backup files, private fixtures and issued access links are excluded from the release.

## Merchant identity and membership

Configure OIDC_ISSUER and OIDC_CLIENT_ID; set AUTH_REQUIRED=true. Add OIDC_CLIENT_SECRET when your provider uses confidential-client Basic authentication. Register the exact callback `<PUBLIC_URL>/auth/callback`. The identity provider must support authorization-code flow with S256 PKCE and signed RS256/PS256/ES256 ID tokens.

Tokens must have the exact issuer/audience, a matching browser-bound nonce, verified email, expiry and fresh authentication time. MFA must appear as `amr: ["mfa"]`, both password and OTP methods, or the exact configured OIDC_MFA_ACR. The provider must emit the required claims. PayTrace does not accept a self-declared role from a token. Roles come from persistent workspace membership.

Set BOOTSTRAP_ADMIN_EMAILS to your verified owner email. A first permitted sign-in creates an empty workspace, without fictional paid purchases. Admins invite verified email addresses through Team access. An invited user signs in with MFA, explicitly accepts the email-bound invitation, and receives its stored role. Invitations expire, are consumed once, and membership revocation invalidates its workspace sessions. Cookies are HttpOnly, SameSite=Lax, Secure on HTTPS. Sessions have a 30-minute idle limit and an absolute limit bounded by the identity token and eight hours.

Set OIDC_ACCOUNT_URL to your identity provider's HTTPS account-management/recovery page. Password reset, recovery, MFA enrollment and account lockout are handled there; no PayTrace password database is created. Demo operator keys and bearer team links cannot bypass AUTH_REQUIRED. Demo mutations are disabled in that mode. NODE_ENV=production always requires authentication and MFA, regardless of an AUTH_REQUIRED=false setting.

## Verification and changed payments

VERIFICATION_MAX_AGE_SECONDS defaults to 300 and is bounded to 60–3600. Passing proof expires across dashboards, receipts and customer views. Historical timestamps remain visible; a recheck does not issue another access grant. Analytics separate recorded historical recovery from currently unexpired verification. Average recovery time uses the first recorded passing verification.

Signature-verified refund/reversal events immediately place a matching purchase on review hold and invalidate existing approvals and learner tokens while authoritative reconciliation is queued. Full refunds/reversals/denied captures confirmed by provider reads suspend the purchase's local access and, where applicable, its purchase-scoped external entitlement. Partial refunds remain under merchant review and do not automatically revoke unrelated platform enrollment. Holds block new approvals and repeat grants. A provider event is never treated as permission to grant access. Hold review is conservative: ambiguous or terminal payments do not automatically reopen.

## Course platform

Set COURSE_API_URL, COURSE_API_TOKEN and the exact configured COURSE_ID, COURSE_NAME, COURSE_AMOUNT_MINOR and COURSE_CURRENCY. Supported price formats use two-decimal USD/EUR/GBP/AUD/CAD minor units. New connected cases require the real platform learner ID. Checkout evidence remains tied to that learner and course. The connector uses HTTPS, strict workspace/purchase matching and capability checks. It persists a grant intent and stable idempotency key before external writes, so an interrupted response can be reconciled without a second grant. External content verification must retrieve the scoped purchased resource; a local demo page cannot satisfy it.

The receiving platform must implement the protocol in [COURSE-CONNECTOR.md](COURSE-CONNECTOR.md), directly or through an adapter. No vendor-specific LMS credentials were supplied and no live LMS compatibility is claimed. Connect and test your actual platform before using real learner data.

## Durable jobs and monitoring

Job state, attempts, leases and next-run times live in SQLite. The web process polls due jobs; `npm run worker` can run the same queue on the same durable host when the web process is unavailable. Database leases fence stale workspace writers; job leases recover after a crash, with bounded retries, exponential delays and visible failed jobs. Due work survives a restart and resumes when a worker runs. No application can execute jobs while every worker/host is stopped.

Reconciliation, customer follow-up scheduling, mail delivery, daily backups, hourly audit checkpoints and optional alerts use this queue. Webhooks are acknowledged after verification/journaling and queued for processing. Operations lets an Admin run due work, inspect failures, retry a failed job or queue a backup. `/health` is liveness; `/ready` reports database and recent worker activity without exposing configuration or customer records.

Mail retries reuse the exact serialized payload and provider idempotency key, stop after five attempts or 23 hours, and mark unresolved deliveries for manual review. Customer email remains opt-in and requires Resend configuration. Provider acceptance is not proof of inbox delivery.

Set ALERT_WEBHOOK_URL and optional ALERT_WEBHOOK_TOKEN for a server-to-server alert sink. Events contain service/error categories and timestamps, not raw exceptions, message content, credentials or customer addresses.

**Deployment boundary:** SQLite/WAL and database leases support processes sharing one durable host/filesystem. Multi-host horizontal scaling is not enabled; do not attach independent hosts to copies of the database and call them a shared cluster. The included hosting configuration uses one service and durable disk. No hosted resource has been provisioned automatically.

## Audit checkpoints and backup restoration

Set a stable AUDIT_HMAC_KEY of at least 32 characters. Production startup also requires BACKUP_DIR, a base64 32-byte BACKUP_ENCRYPTION_KEY, AUDIT_CHECKPOINT_URL and a 32+ character AUDIT_CHECKPOINT_TOKEN. Keep these outside source control and retain them across deployments. Keys are not generated into the release. Losing a backup key prevents decrypting its backups; changing an audit key without migration breaks old keyed verification.

Backups use SQLite's online snapshot API, AES-256-GCM when configured, a digest and table-count manifest, and an automatic restoration/integrity probe before reporting success. Keep 2–30 snapshots (default seven). Plaintext development backups are visibly labeled and contain only the demo workspace in this review instance. Use private directories, volume encryption and restricted filesystem permissions for real data. Copy encrypted backups off the host through your chosen backup service; local backup success does not protect against losing the whole disk.

Restore to a NEW database file while the app is stopped:

```
npm run restore -- /private/backups/paytrace-example.pbackup /private/restored-new.sqlite
```

Existing destination files are never overwritten. Verify the result, then point DATABASE_PATH at the restored file and restart. The automated suite exercises encrypted restoration, wrong keys, altered manifests and overwrite refusal.

AUDIT_CHECKPOINT_DIR can keep local signed checkpoint files. For independent evidence, configure AUDIT_CHECKPOINT_URL: the worker posts `{payload,signature}` with a Bearer token and HMAC signature. The payload contains workspace IDs, sequence numbers and chain heads. The sink should append immutably and retain records independently. A local checkpoint alone cannot detect a privileged full-host rollback. Backups retain audit entries; audit records are not silently purged. Operational event retention is bounded, and expired account sessions/sign-in attempts/invitations are pruned.

## External acceptance — explicit, opt-in

The default suite has **154 passing tests**. `npm run test:live` is separate and skips unless RUN_LIVE_ACCEPTANCE=1. The live test requires sandbox credentials, LIVE_CASE_FILE (a captured case state), LIVE_WEBHOOK_FILE (`{headers,body}` from a genuine signed PayPal event), LIVE_WORKSPACE_ID, course credentials and AUDIT_HMAC_KEY. Keep these under ignored `private/` or outside the repository. The runner performs reads/signature checks, rejects a forged signature, and optionally writes an HMAC-signed LIVE_ACCEPTANCE_REPORT. It does not create charges, approve purchases or issue refunds.

Complete the account-specific walkthrough before activation: verified owner login and MFA; exact learner/course case; approved PayPal sandbox checkout; evidence review and exact merchant approval; one external grant; actual content check; valid and invalid webhook delivery; duplicate events; an interruption/retry; partial/full refund or reversal in the provider sandbox; access hold/suspension; and an encrypted backup/restore drill. Those interactions require your configured provider accounts. The operations page distinguishes a signed read-only acceptance report from configuration and does not claim the complete walkthrough ran.

No live credentials were supplied in this session. OIDC cryptographic verification, scope/role enforcement, refund handling, queue crash/retry behavior, external connector contracts and backup restoration were exercised by the automated suite. Browser checks use labeled fictional records. No real customer email, charge, refund or enrollment was performed.

## Technical references

- OpenID Connect validation: https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation
- JOSE verification: https://github.com/panva/jose
- PayPal captured payment status: https://developer.paypal.com/api/payments/v2/definitions/capture_status/
- SQLite online backups: https://nodejs.org/api/sqlite.html#sqlitebackupsourceDb-path-options
- Resend idempotency: https://resend.com/blog/engineering-idempotency-keys

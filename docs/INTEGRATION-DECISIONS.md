# Darius backend integration: safety-first branch

This branch integrates selected backend safeguards into the current PayTrace app. It preserves the existing four-specialist AI review, opt-in sandbox automation, customer portal, and Azure-facing course-service contract. It is **not** a merge of the full `backend-paytrace-recover` branch and has not been deployed.

## Integrated now

- SQLite-backed scheduled scan and mail jobs with leases, retries, and restart persistence replace the two in-process timers. The existing `service.scan`, `service.autoTriage`, and customer mail flow remain the job handlers.
- Workspace mutations now use a SQLite lease as well as the local lock, so two processes sharing the database serialize work on the same merchant workspace.
- Accepted PayPal webhooks enqueue a durable follow-up reconciliation job before the event is marked processed. The event remains a trigger; the job rereads PayPal and course evidence and cannot authorize a grant by itself.
- Customer-email delivery retries transient or uncertain outcomes with the same message body, private link, and provider idempotency key. Retries stop after five attempts or before the 24-hour link expires. Private-link requests are capped at three per case and recipient per day, and completed sends no longer retain the link body in the outbox.
- An external grant intent is saved before the course-service request. If its outcome is uncertain, PayTrace checks the current entitlement on retry and never sends a second grant for that intent. The existing course-service idempotency key remains unchanged.
- Render workflow jobs have a deadline. Expired callbacks cannot resume the old job or repeat a grant; merchant review or read-only verification is required.
- A verified PayPal refund, reversal, or denial event puts the matching case on a provisional hold. Fresh PayPal reads update the hold, and PayTrace blocks grant actions and its customer lesson route while the hold remains.
- A fresh full refund, reversal, or denial also suspends the exact entitlement in the separate reference course service, using a stable idempotency key and a fresh inactive-access check. A mismatch or uncertain suspension keeps the payment hold and retries safely. Partial refunds remain manual. The customer portal explains the pause without exposing payment details.
- Anonymous `/api/state` creation is limited in SQLite to 20 new sessions per network address per hour and 500 public demo workspaces per database. Existing sessions continue to work. This closes unbounded workspace creation on the public demo route, but the cap needs operator monitoring and a deliberate retention policy before a production pilot.
- The existing database can now be backed up to an encrypted, SQLite-consistent snapshot and restored to a new file for a row-count and integrity check. This is a manual operator command; scheduling and off-host retention remain release work. See [BACKUPS.md](BACKUPS.md).
- Darius's workspace pulse now appears on the recovery desk. It prioritizes due internal reminders, customer replies, unfinished verification, source failures, and overdue paid access using current workspace records. The snapshot and CSV omit private conversation text; CSV export requires the operator session. Merchants can set a case to low, normal, or high priority with revision checks; this changes queue order without changing payment evidence, approval, or access.

## Explicit choices still needed

- **Merchant identity:** retain the current demo operator key for the public demonstration. Integrate Darius's OIDC/MFA account and team model only with a defined tenant migration and role-to-action policy. It should be a separate change so existing sandbox cases and customer links are not silently reassigned.
- **Course connector:** retain `COURSE_ACCESS_URL` and `COURSE_ACCESS_API_KEY` plus the current `/v1/access/*` reference contract for this integration. Darius's `COURSE_API_URL` connector has a different identity and suspension contract; choose one contract and migrate the reference service and acceptance tests together.
- **Production refund suspension:** the reference course service now enforces suspension for its own protected lesson. A production connector must implement the same purchase-bound suspension and direct learner-facing access enforcement before claiming access is revoked on another platform.
- **Automation approval:** opt-in policy grants remain narrowly bounded to sandbox cases. Reconcile that standing merchant authorization with role-based approvals and audit language before enabling it for multi-merchant use.

## Release gate

Keep this branch out of the hosted app until PayPal sandbox credentials and a Render Workflow are configured and an end-to-end acceptance run proves: exact capture match, model-backed review, merchant approval or explicit standing policy, one course-service grant, protected-lesson verification, restart-safe webhook reconciliation, signed refund/reversal hold, and clear customer status. Exercise one interrupted email delivery with a test provider as well. Run `npm test` and inspect the connected run report before promoting the branch.

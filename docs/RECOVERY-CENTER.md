# Recovery Center integration

Open `/recovery.html` from the Recovery desk footer. This integration preserves the existing four-agent review, customer portal, PayPal sandbox flow, Render hooks, and `COURSE_ACCESS_URL` connector.

The Recovery Center adds UTC cohort analytics with currency-separated totals; deduplicated attention alerts; a verification receipt that expires with its underlying proof; read-only case history; rule-based priorities with an optional AI second look; bounded internal and optional customer-email follow-ups; a searchable audit hash chain; team access links; and an operations view for durable jobs and encrypted backup status. AI rankings do not authorize actions. Follow-ups are off by default, require a 24-hour minimum cooldown, and never charge or grant access.

The owner must unlock the demo operator session before inviting or revoking a team member. Links are shown once, expire, and can be revoked immediately. Analyst and Read-Only responses are redacted and their writes are blocked by the server. These links identify a role and a label, not a verified person. They are for the sandbox demonstration only. Merchant OIDC/MFA and tenant migration remain a separate production change; do not use this demo identity mode for real customer data or live payments.

Set `AUDIT_HMAC_KEY` to a stable, private value of at least 32 characters to key new audit entries. Earlier unkeyed entries remain readable. Preserve the key and export checkpoints outside the database to detect a complete database rollback. The audit log starts with this integration and cannot reconstruct earlier actions.

The payment webhook remains `/api/paypal/webhook`; its verified event only schedules authoritative reads. Do not register Darius's alternate `/api/webhooks/paypal` URL for this branch. The current course-service contract remains `/v1/access/*`. See [INTEGRATION-DECISIONS.md](INTEGRATION-DECISIONS.md) for the deliberate identity and connector boundary.

Run `npm test` and test the screen against the Node server. Connected PayPal sandbox, Render Workflow, course service, email and model acceptance are still required before deploying this branch as the public connected demo. A configured credential alone is not evidence that a live recovery completed.

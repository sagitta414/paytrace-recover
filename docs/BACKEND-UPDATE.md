# Backend update and validation

Upstream GitHub main incorporated: ae216c815358b925a1a4475e99f07e1b55ab5946. Includes customer progress, private customer messaging, notification setup, guided recovery stories, the redesigned case review, and the previously applied local UI fixes.

## Backend fixes

- Workflow callbacks must follow gather/analyze/record or repair/verify order.
- Completed stage results are saved in SQLite and returned on retries, without repeating analysis, verification, or regressing the case. Persistence across database reopen is tested.
- Failed workflow stages can resume in order. Obsolete jobs and callbacks for another case are rejected.
- Frontend recovery and PayPal actions now send the displayed case ID. The backend rejects an action when another tab has selected a different case. Lesson, draft, receipt, and learner-session endpoints also check supplied case identifiers.
- JSON requests must contain an object, use the correct media type, and fit within a 20,000-byte limit. UTF-8 chunks are assembled before parsing.
- Repeating a sandbox capture request refreshes payment/access evidence instead of returning stale payment status or capturing again.

## Validation

- 87 automated tests passed, 0 failed. Includes six new backend regression tests, existing business invariants, HTTP authorization/origin checks, persistence, customer-support privacy, and mocked provider contracts.
- The combined app completed a fresh browser recovery on port 4359: create sample purchase, investigate, preview, explicit approval, apply, verify, and retrieve the protected lesson. Result: one access grant and one verification attempt. No browser console errors observed during this check.
- The running backend on http://127.0.0.1:4359 was restarted with the updated code and retained the existing local database.
- Port 4357 serves the updated static source. Port 4358 is the older extracted copy.

## Running the ZIP

Use Node 24+. Unzip, run npm ci, npm test, then npm start. Default port: 4358. If occupied, choose a free PORT and set PUBLIC_URL to the same origin. Copy .env.example to .env only when you need optional credentials/configuration. No .env, credentials, node_modules, Git internals, or local database are included in the source archive.

Live PayPal, OpenAI, Render workflow execution, and Resend email delivery were not exercised with real credentials. Those acceptance checks remain necessary before using the corresponding integrations. This remains the project's single-instance demo backend, not production merchant authentication or an external LMS connector. No customer email was sent during validation.

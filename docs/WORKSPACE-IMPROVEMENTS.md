# Workspace and backend improvements

This update builds on main 087dc2306d1a32bbd0fac1f202a1f552b9cea190 and preserves the earlier backend safeguards.

- Recovery pulse ranks due reminders, customer replies, unfinished verification and overdue access. Counts describe saved records, not live provider health. Refresh records to obtain new evidence.
- Case priorities persist in SQLite and remain scoped to the current workspace. Revision checks reject conflicting edits from another tab. Priority never grants access or changes approval.
- Queue CSV export includes status and amounts in minor currency units, excludes customer messages, email addresses and notes, and neutralizes spreadsheet formulas.
- Pending workflows expire after 15 minutes by default. Set WORKFLOW_TIMEOUT_SECONDS from 60 to 3600. Expired callbacks cannot apply late changes; an existing grant is retained and requires verification. Retrying a recorded grant verifies without granting again.

New endpoints: GET /api/workspace, GET /api/workspace/export, GET and POST /api/case/priority. Existing session, ownership and origin checks apply. A conflicting priority revision returns 409.

Validation: npm test passes all 110 tests, including HTTP authorization, persistent priority revisions, privacy-safe exports, workflow expiry, callback rejection and grant idempotency. Browser checks covered pulse refresh, attention navigation, priority save/reload and conflicting tabs, explicit approval, one grant followed by verification, CSV download, resolved-case removal and mobile layout.

Run with Node 24+: npm ci, npm test, npm start. Default backend port is 4358; the current development preview uses 4359 with PUBLIC_URL configured accordingly. Static simulation uses node serve.cjs on 4357. Configure optional provider credentials using .env.example; no credentials or .env files belong in Git. Live PayPal, OpenAI, Render and email acceptance still require configured accounts and have not been exercised in this update. SQLite and in-process locks remain intended for one service instance.

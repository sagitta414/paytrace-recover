# PayTrace Recover — Payment made. Access restored.

PayTrace Recover helps merchants resolve cases where a customer paid but didn’t receive the digital access they purchased.

[Public Focus dashboard demo](https://courselatch.sagitta107.chatgpt.site/focus.html) · [Setup instructions](docs/SETUP.md) · [Focus frontend and reliability](docs/FOCUS-FRONTEND.md)

**Building the connected version? Start with the [detailed PayPal Sandbox and Render Build README](docs/BUILD-README.md).** It covers account setup, environment variables, local checkout, AI review, persistent hosting, Render Workflows, acceptance tests, troubleshooting, and release readiness.

The public link runs a browser simulation using fictional records. Run the Node backend below to explore server-backed recovery; external integrations require your own sandbox credentials.

The first working example is a paid course with missing access. The app checks the evidence, rehearses the smallest correction on a copy, asks the merchant to approve the exact change, applies it once, and checks the outcome. Memberships and downloads are future directions to validate, not supported connectors.

## What works today

- Public static demonstration: nine scenarios, a seven-purchase sample portfolio, delivery-window monitoring, distinct diagnoses, related-case filtering, editable customer drafts, and the existing reviewed recovery flow. Records and agent consultations are fictional.
- Local Node backend: isolated cookie sessions, durable SQLite records, protected lesson-access endpoint, same-origin mutation checks, operator gate for configured integrations, serial per-session writes.
- Setup-ready adapters: PayPal sandbox order creation/capture/fresh reads; six bounded OpenAI Responses calls with cited objections, responses, and final review; Render investigation and approved-recovery task chains.
- Automated tests cover business invariants and mocked integration contracts. **Live PayPal, OpenAI, and Render credentials were not supplied; those services have not been tested end to end.** The published Sites version is the browser simulation, not the Node service.

## Run

Use Node 24 or newer. From this directory:

```sh
npm ci
npm test
npm start
```

Open http://127.0.0.1:4358. It works without credentials in server-demo mode. To run the exact static publication instead, use `node serve.cjs` and http://127.0.0.1:4357.

See [integration setup](docs/SETUP.md), [product scope](docs/PRODUCT.md), [demo script](docs/DEMO_SCRIPT.md), and [seller research kit](docs/SELLER_RESEARCH.md).

The [development plan](docs/DEVELOPMENT_PLAN.md) sequences the Render and AG Studio build, live integration checks, and the later merchant pilot.

## Structure

`dist/` is the published static site. `dist/core.mjs` contains shared recovery rules. `server/` owns durable state, provider calls, and authorization. `workflows/` defines Render tasks. `tests/` verifies the rules and HTTP/provider boundaries. `render.yaml` configures an optional web service; Workflows are configured separately. `.openai/hosting.json` retains the existing Sites project identity.

The original PayTrace design remains in `source/` as historical design material. Do not run the legacy `export-demos.cjs` generator: it would restore the old visual pages. Current pages are authored directly in `dist/`. Existing portrait illustrations are fictional characters.

## Prototype boundaries

Default mode uses isolated fictional merchant workspaces. Configured verified-account mode adds OIDC/MFA, durable memberships, provider webhooks, optional email and a purchase-scoped external course connector. PayPal remains sandbox-only; no live business acceptance is claimed. The storefront deliberately injects an access-update failure after capture; it does not diagnose an actual third-party store outage. The AI interprets supplied records but cannot authorize or execute writes. Citations are checked for valid source IDs, not automatically proven factually correct. Merchant approval and deterministic checks remain necessary.

SQLite/WAL, database-backed leases, durable jobs and external-write intents support one durable host, with optional same-host worker processes. Multi-host horizontal scaling is not enabled. Authenticated deployment requires your configured identity provider, course bridge, secret keys, external audit sink and live acceptance checks. Approval is specific to the previewed evidence. Verification checks current state, not a permanent guarantee.

PayTrace Recover is a working name, not a trademark-clearance claim. This is an independent project, not an official PayPal product.

## Agent challenge round

The merchant sees a compact decision card before rehearsal. Expand it for categorized objections, one response round, and source records frozen at review time. Outcomes are ready for rehearsal, needs evidence, blocked, or verify only. Existing access is checked with zero repair writes; changed evidence invalidates review and approval. Unknown timeout cause stays visible.

Cases D–F demonstrate missing payment evidence, an earlier store retry restoring access, and a payment reference changing after review. Read [challenge validation](docs/CHALLENGE_ROUND.md) for invariants and the demo sequence.

## Five connected improvements

1. **Access Watch:** configurable 1–60 minute delivery window, manual checks, and reconciliation every 30 seconds. The backend checks saved purchases while running; the static demo checks sample records while the page is visible. Complaint timing stays unknown unless recorded.
2. **Cause-specific routing:** missing enrollment can proceed to review; wrong login, expired access, pending payment, and conflicting records require different next steps and cannot trigger the same grant.
3. **Related cases:** correlate the same merchant, course, enrollment error, and 15-minute payment window. Similarity is not proof of shared cause. Each purchase requires separate review and approval.
4. **Protected-content proof:** the Node verifier makes an authenticated HTTP request using a short-lived, case/learner/course-scoped capability, checks returned lesson content, then revokes the token. The separate course-access record must agree with the purchase. This verifies our demo content service, not an external LMS or a real customer's device. The public static version explicitly simulates verification.
5. **Customer response:** an editable evidence-based template that claims restoration only after current verification passes. Copying never sends a message. Templates are deterministic; the optional AI integration still handles specialist review.

The custom investigation console is working; **AG Studio remains planned**. See [setup and prototype limits](docs/SETUP.md) before attempting a live deployment.

## License

Project source is available under the [MIT License](LICENSE). Third-party dependencies retain their own licenses. PayPal names and marks belong to their respective owners; this license grants no trademark rights or endorsement.
# Customer progress and messaging

Customers can follow a private case, message the merchant, answer information requests, open verified demo course content, and confirm success or ask for more help. Admin notes stay private. Start in the Focus case’s **Customer communication** panel; see [customer support setup and testing](docs/CUSTOMER-SUPPORT.md). Email alerts require optional Resend configuration and report provider acceptance separately from delivery.

## Follow the recovery story

Open `/story.html` for the interactive Merchant/Customer story, including a successful recovery and a mismatched payment the system refuses to repair. The story uses labeled local sample data and scripted analysis. The connected Focus workspace also includes a concise decision brief and measured outcome facts. See the [demo walkthrough and measurement boundaries](docs/DEMO-STORY.md).

## Local backend update

This source package incorporates upstream revision `087dc2306d1a32bbd0fac1f202a1f552b9cea190` and the earlier local UI fixes. Additional backend checks enforce workflow stage order, persist completed stage results for safe callback retries, reject stale case identifiers from browser tabs, validate JSON request objects and byte limits, and refresh existing sandbox captures without capturing again. Browser actions pass the selected case ID to the backend.

Run `npm ci`, `npm test`, and `npm start` with Node 24 or newer. The default URL is http://127.0.0.1:4358; configure both `PORT` and `PUBLIC_URL` when choosing another port. Use `.env.example` for optional integration configuration. The complete suite contains 154 tests, including HTTP, persistence, private customer support, and mocked provider contracts. Live PayPal, AI, workflow, and email acceptance tests still require your own credentials.

See [workspace and backend improvements](docs/WORKSPACE-IMPROVEMENTS.md) for the recovery pulse, persistent priorities, queue CSV export, workflow expiry, validation and setup boundaries.


## Recovery Center

Open `/recovery.html` for analytics, bounded follow-ups, security audit search, team roles, payment reconciliation, case history, notifications, explainable AI suggestions and traceable recovery receipts. See [Recovery Center setup and limitations](docs/RECOVERY-CENTER.md). This source includes 154 passing tests. Demo team links are separate from verified-account memberships. Provider activation, protected keys and external audit/backup destinations require server configuration.

## Final backend safeguards

See [final setup and handoff](docs/FINAL-SETUP.md) for verified OIDC/MFA accounts, durable memberships, expiring evidence, refund/reversal holds, external course writes, persistent job leases, encrypted backup/restore probes, signed audit checkpoints, operations alerts and opt-in live acceptance. No credentials or runtime data are included.

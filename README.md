# PayTrace Recover — Payment made. Access restored.

PayTrace Recover helps merchants resolve cases where a customer paid but didn’t receive the digital access they purchased.

[Judge walkthrough](https://paytrace-recover-sagitta.azurewebsites.net/judge.html) · [Azure merchant workspace](https://paytrace-recover-sagitta.azurewebsites.net/focus.html) · [Public browser simulation](https://courselatch.sagitta107.chatgpt.site/focus.html) · [Setup instructions](docs/SETUP.md)

The [Azure Node demo and integration checklist](docs/AZURE-DEPLOYMENT.md) documents the server-backed deployment separately from the public browser simulation.

The local presentation route is `/` → `/story.html` → `/focus.html?from=story` → a private customer case link. The guided story and merchant workspace are separate examples, so their case state does not transfer. In the browser demo, the handoff opens Maya's seeded Focus case; on the server, it opens the merchant's own case queue. See the [screen-by-screen story](docs/DEMO-STORY.md).

**Building the connected version? Start with the [current connected-demo checklist](docs/CONNECTED-DEMO.md) and [detailed PayPal Sandbox and Render Build README](docs/BUILD-README.md).** They cover account setup, environment variables, checkout, AI review, persistent hosting, Render Workflows, acceptance tests, and release readiness.

An optional [separate course-access service](docs/COURSE-ACCESS.md) now lets sandbox cases read, grant, and verify access outside PayTrace's SQLite store. The repository includes a small local reference service for a two-process demo; it is not a commercial LMS connector.

Optional [PayPal sandbox webhook intake](docs/PAYPAL-WEBHOOKS.md) verifies capture events, rereads the exact payment from PayPal, and checks access for an existing case. Webhooks never approve or apply a repair.

The Focus workspace now shows a downloadable [recovery run report](docs/RUN-REPORT.md) that labels each saved payment, access, AI, approval, Render, and lesson check as connected, demo, or incomplete.

The merchant case view also includes an interactive Break Point Map from PayPal capture to protected lesson. Each step exposes its saved source record, evidence status, check time when available, and responsible specialist. The highlighted step identifies the first actionable break without claiming its underlying cause. An expandable purchase comparison shows the expected and observed status, order, learner, course, amount, currency, and account or term checks. Browser samples, server demo records, and connected sandbox reads are labeled separately; unavailable sources and stale proof remain unknown.

The Connections screen can perform a read-only authenticated check against the separate course service before a recovery run. It checks a new test entitlement and never grants access; a successful connection check does not claim that lesson verification or an end-to-end recovery passed.

The judge walkthrough now offers a single short route through the sample story and merchant workspace, with a separate sandbox readiness callout. The Focus desk reports verified access, cases held for evidence, writes awaiting verification, and technically verified cases awaiting customer confirmation. The merchant can set a customer-visible next progress-update time independently of private reminders; it makes no promise that access will be restored by that time.

The guided story now hands viewers into the merchant workspace. The judge page shows current configuration separately from completed case evidence; the Connections page tracks four pre-Render checkpoints. Sandbox intake stays unavailable until PayPal credentials are configured. Activity can be searched and filtered with full dates, while the customer view distinguishes the latest case message from the last merchant reply. The case view presents one specialist evidence section instead of repeating the same four findings.

The public link runs a browser simulation using fictional records. Run the Node backend below to explore server-backed recovery; external integrations require your own sandbox credentials.

The first working example is a paid course with missing access. The app checks the evidence, rehearses the smallest correction on a copy, asks the merchant to approve the exact change, applies it once, and checks the outcome. Memberships and downloads are future directions to validate, not supported connectors.

## What works today

- Public static demonstration: nine scenarios, a seven-purchase sample portfolio, delivery-window monitoring, distinct diagnoses, related-case filtering, editable customer drafts, and the existing reviewed recovery flow. Records and agent consultations are fictional.
- Local Node backend: isolated cookie sessions, durable SQLite records, protected lesson-access endpoint, same-origin mutation checks, operator gate for configured integrations, serial per-session writes.
- Setup-ready PayPal sandbox order creation/capture/fresh reads and Render investigation and approved-recovery task chains. The Azure app now runs six to eight bounded Azure OpenAI Responses calls with cited objections, specialist responses, and final review. A separate Azure reference course-access service is configured for sandbox cases.
- Merchant agent desk: a plain-language decision brief, live specialist progress, and read-only follow-up questions tied to the saved review. Model answers keep their cited source records and cannot approve or apply an access change. Follow-ups require an unlocked operator session and configured AI; the public browser demo remains scripted.
- Automated tests cover business invariants and mocked integration contracts. The Azure model-backed specialists passed a live five-scenario evaluation, and the separate course service passed authenticated and unauthorized read checks. **PayPal sandbox and Render Workflows are not configured on the Azure app; an end-to-end connected recovery has not been demonstrated.** The published Sites version remains a browser simulation.

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

The [safety-first backend integration decisions](docs/INTEGRATION-DECISIONS.md) describe the current Darius work being brought into a separate branch, the merchant-identity and course-connector choices, and the connected acceptance gate before deployment.

## Structure

`dist/` is the published static site. `dist/core.mjs` contains shared recovery rules. `server/` owns durable state, provider calls, and authorization. `workflows/` defines Render tasks. `tests/` verifies the rules and HTTP/provider boundaries. `render.yaml` configures an optional web service; Workflows are configured separately. `.openai/hosting.json` retains the existing Sites project identity.

The original PayTrace design remains in `source/` as historical design material. Do not run the legacy `export-demos.cjs` generator: it would restore the old visual pages. Current pages are authored directly in `dist/`. Existing portrait illustrations are fictional characters.

## Prototype boundaries

One isolated demo merchant workspace with multiple fictional learners and one course per session. No production payments, refunds, commercial LMS connector, or production merchant authentication. Sandbox webhook intake is implemented but has not been validated with a live PayPal delivery. The storefront deliberately injects an access-update failure after capture; it does not diagnose an actual third-party store outage. The AI interprets supplied records but cannot authorize or execute writes. Citations are checked for valid source IDs, not automatically proven factually correct. Deterministic checks and either exact case approval or a merchant-enabled narrow sandbox policy remain necessary.

SQLite persistence, durable scheduled jobs, and an in-process session lock support a single web-service instance. A production service still needs tenant authentication, shared authorization and idempotency across multiple hosts, durable webhook processing, retention controls, verified refund suspension at the course platform, and a real course platform adapter. Approval is specific to the previewed evidence or a narrow merchant-enabled sandbox policy. Verification checks current state, not a permanent guarantee.

PayTrace Recover is a working name, not a trademark-clearance claim. This is an independent project, not an official PayPal product.

## Agent challenge round

The merchant sees a compact decision card before rehearsal. Expand it for categorized objections, one response round, and source records frozen at review time. The agent desk adds a short decision brief and optional cited follow-up questions. Outcomes are ready for rehearsal, needs evidence, blocked, or verify only. Existing access is checked with zero repair writes; changed evidence invalidates review and approval. Unknown timeout cause stays visible.

Cases D–F demonstrate missing payment evidence, an earlier store retry restoring access, and a payment reference changing after review. Read [challenge validation](docs/CHALLENGE_ROUND.md) for invariants and the demo sequence.

## Five connected improvements

1. **Access Watch:** configurable 1–60 minute delivery window, manual checks, and reconciliation every 30 seconds. The backend checks saved purchases while running; the static demo checks sample records while the page is visible. Complaint timing stays unknown unless recorded.
2. **Cause-specific routing:** missing enrollment can proceed to review; wrong login, expired access, pending payment, and conflicting records require different next steps and cannot trigger the same grant.
3. **Related cases:** correlate the same merchant, course, enrollment error, and 15-minute payment window. Similarity is not proof of shared cause. Each purchase requires a separate review; a correction requires either exact case approval or the merchant's narrow sandbox automation policy.

### Opt-in automatic recovery

The Connections screen includes a merchant-controlled policy, **off by default**. The operator can set a maximum purchase amount and a daily case limit. It can be enabled only when PayPal sandbox, the external course-access service, and AI are configured. For the single demo course, PayTrace can then investigate an overdue case, require a current model-backed review with every objection resolved, rehearse the exact grant, match it against the merchant's policy, reread PayPal and access, apply one grant, and verify the protected lesson. The case records the policy ID and exact preview used. Mismatches, unsupported cases, exhausted limits, unavailable sources, and uncertain writes go to merchant review. A failed lesson check is retried with reads only. The policy can be disabled at any time; changes are serialized with in-flight recovery operations.

This path currently runs inside the PayTrace server monitor, not Render Workflows. It is tested with mocked sandbox and course-service adapters. The published Azure app still lacks PayPal sandbox credentials, so automatic grants cannot be enabled or claimed as a live connected demonstration yet. Production use needs real merchant authentication and a full operational review.

If the course system restores a known sandbox purchase on its own, the monitor now verifies the current PayPal capture, matching entitlement, and protected lesson automatically **without an access write or merchant approval**. A failed lesson check remains open and schedules read-only rechecks. A successful proof updates the private customer tracker and records that no PayTrace grant was needed. This read-only path works independently of the AI configuration and the grant policy.
4. **Protected-content proof:** the Node verifier makes an authenticated HTTP request using a short-lived, case/learner/course-scoped capability, checks returned lesson content, then revokes the token. The separate course-access record must agree with the purchase. This verifies our demo content service, not an external LMS or a real customer's device. The public static version explicitly simulates verification.
5. **Customer response:** an editable evidence-based template that claims restoration only after current verification passes. Copying never sends a message. Templates are deterministic; the optional AI integration still handles specialist review.

The custom investigation console is working; **AG Studio remains planned**. The [judge walkthrough](dist/judge.html) separates the sample tour from the connected sandbox path. See [setup and prototype limits](docs/SETUP.md) before attempting a live deployment.

## License

Project source is available under the [MIT License](LICENSE). Third-party dependencies retain their own licenses. PayPal names and marks belong to their respective owners; this license grants no trademark rights or endorsement.
# Customer progress and messaging

Customers can follow a private case, message the merchant, answer information requests, open verified demo course content, and confirm success or ask for more help. Admin notes stay private. Start in the Focus case’s **Customer communication** panel; see [customer support setup and testing](docs/CUSTOMER-SUPPORT.md). Email alerts require optional Resend configuration and report provider acceptance separately from delivery.

## Follow the recovery story

Open `/story.html` for a seven-chapter Merchant/Customer story: a paid purchase with missing access, an evidence-linked four-specialist challenge, merchant approval of one correction, fresh verification, and customer confirmation. Alternate paths show a mismatched payment held safely, a verification failure that needs another check, and a customer who still needs help after technical verification. The merchant can acknowledge that report, recheck without a second grant, and explicitly send a state-aware customer update drafted by the scripted Relay specialist. This story uses labeled local sample data and scripted analysis. The connected Focus workspace also includes a concise decision brief and measured outcome facts. See the [demo walkthrough and measurement boundaries](docs/DEMO-STORY.md).

## Local backend update

This source package incorporates upstream revision `ae216c815358b925a1a4475e99f07e1b55ab5946` and the earlier local UI fixes. Additional backend checks enforce workflow stage order, persist completed stage results for safe callback retries, reject stale case identifiers from browser tabs, validate JSON request objects and byte limits, and refresh existing sandbox captures without capturing again. Browser actions pass the selected case ID to the backend.

Run `npm ci`, `npm test`, and `npm start` with Node 24 or newer. The default URL is http://127.0.0.1:4358; configure both `PORT` and `PUBLIC_URL` when choosing another port. Use `.env.example` for optional integration configuration. The automated suite covers HTTP, persistence, private customer support, a separate course service, mocked webhook verification, run-report truth checks, and recovery safety regressions. GitHub Actions now runs the suite on pull requests and pushes to `main`. Live PayPal, Render workflow, and email acceptance still require service configuration. Use `npm run ai:eval` with a server-side model key to check five fictional review outcomes without applying a repair. Optional Azure Application Insights recovery tracing and Codex review rules are described in [Observability and release checks](docs/OBSERVABILITY.md).

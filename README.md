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

One isolated demo merchant workspace with multiple fictional learners and one course per session. No production payments, refunds, email sending, external LMS connector, webhook listener, or production merchant authentication. The storefront deliberately injects an access-update failure after capture; it does not diagnose an actual third-party store outage. The AI interprets supplied records but cannot authorize or execute writes. Citations are checked for valid source IDs, not automatically proven factually correct. Merchant approval and deterministic checks remain necessary.

SQLite persistence and an in-process session lock support a single web-service instance. A production service needs tenant authentication, transactional idempotency with shared storage, webhook signature validation, retention controls, reconciliation jobs, refund/revocation handling, and a real course platform adapter. Approval is specific to the previewed evidence. Verification checks current state, not a permanent guarantee.

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

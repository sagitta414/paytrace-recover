# CourseLatch — Paid should mean in.

A PayPal + AI course-access recovery prototype. Maya paid for a workshop, but the access update failed. CourseLatch checks the evidence, rehearses the smallest correction on a copy, asks the merchant to approve the exact change, applies it once, and checks whether the lesson opens.

## What works today

- Public static demonstration: fictional records, scripted specialist consultations, three interactive cases, learner storefront, merchant desk, preview, approval, verification, source drilldown, audit trail, JSON recovery receipt.
- Local Node backend: isolated cookie sessions, durable SQLite records, protected lesson-access endpoint, same-origin mutation checks, operator gate for configured integrations, serial per-session writes.
- Setup-ready adapters: PayPal sandbox order creation/capture/fresh reads; four OpenAI Responses consultations with structured evidence citations; Render investigation and approved-recovery task chains.
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

## Structure

`dist/` is the published static site. `dist/core.mjs` contains shared recovery rules. `server/` owns durable state, provider calls, and authorization. `workflows/` defines Render tasks. `tests/` verifies the rules and HTTP/provider boundaries. `render.yaml` configures an optional web service; Workflows are configured separately. `.openai/hosting.json` retains the existing Sites project identity.

The original PayTrace design remains in `source/` as historical design material. Do not run the legacy `export-demos.cjs` generator: it would restore the old visual pages. Current pages are authored directly in `dist/`. Existing portrait illustrations are fictional characters.

## Prototype boundaries

One fictional merchant, learner, course, and entitlement per session. No production payments, refunds, email sending, external LMS connector, webhook listener, or production merchant authentication. The storefront deliberately injects an access-update failure after capture; it does not diagnose an actual third-party store outage. The AI interprets supplied records but cannot authorize or execute writes. Citations are checked for valid source IDs, not automatically proven factually correct. Merchant approval and deterministic checks remain necessary.

SQLite persistence and an in-process session lock support a single web-service instance. A production service needs tenant authentication, transactional idempotency with shared storage, webhook signature validation, retention controls, reconciliation jobs, refund/revocation handling, and a real course platform adapter. Approval is specific to the previewed evidence. Verification checks current state, not a permanent guarantee.

CourseLatch is a working name, not a trademark-clearance claim. This is an independent project, not an official PayPal product.

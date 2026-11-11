# Title

PayTrace Recover — From paid purchase to proven digital access

## One-line Summary

PayTrace Recover helps a merchant investigate a PayPal sandbox purchase whose digital lesson stayed locked, explain the evidence with four AI specialists, approve a narrow access correction, and verify that the protected lesson opens.

## Problem

A buyer can complete a payment yet never receive the course, download, or membership access they bought. The buyer sees silence; the merchant has to reconcile payment, order, entitlement, and support records across systems. A payment receipt alone does not prove delivery, and a blind retry can grant the wrong account or duplicate a change.

## Solution

PayTrace keeps one case timeline from reported missing access to a checked outcome. It reads the exact PayPal sandbox order/capture and a separate course-service entitlement, flags contradictions, asks four AI specialists to explain the evidence and objections, previews one purchase-bound grant, and records merchant approval or a narrowly configured sandbox policy. After any grant it rereads payment, entitlement, and protected lesson. The customer can follow a private progress timeline, reply, and confirm whether the lesson works on their device.

## Why This Matters

Digital delivery failures are easy to miss and hard for buyers to track. PayTrace turns a vague support ticket into a case with visible evidence, an accountable decision, and a verifiable access outcome. Its key distinction is the post-correction proof, including a fresh protected-content check and a separate buyer confirmation.

## How We Used AI

Four Azure OpenAI-backed specialists — Ledger, Relay, Patch, and Prism — review the current case snapshot from different perspectives. They cite saved evidence, surface unresolved objections, and recommend the next safe step. Their output does not authorize payment capture or access writes. Deterministic checks still require an exact completed sandbox payment, matching learner/course/amount/currency, current entitlement state, and an approved preview or bounded merchant policy. The UI labels scripted sample consultations separately from model-backed reviews.

## How We Used Codex

Codex helped build the merchant and customer flows, integrate and compare frontend/backend work, write safety tests, diagnose Azure startup and deployment failures, and implement fixes from a whole-repository security/functionality review. The fixes cover purchase ownership, revoked-link mail races, read-only data exposure, demo-capacity expiry, explicit provider refresh, and backup handling. The team verified the result with automated tests and an Azure paired deployment.

## Key Features

- PayPal sandbox order/capture integration with fresh payment checks and webhook handling.
- Separate tenant-scoped reference course service for entitlement reads, idempotent grants, suspensions, and protected-lesson probes.
- Guided merchant desk with an attention-first queue, five-check recovery readiness, cited AI consultations, exact correction preview, approval, compact technical outcome, and full run report.
- Private customer case tracker with the latest merchant reply, planned update time, messages, lesson access, and separate buyer confirmation.
- Durable worker, retry and payment-hold behavior, optional bounded sandbox autopilot, and audit trail.
- Connection studio, Recovery Passport, judge walkthrough, and clear labels for demo versus connected evidence.

## Architecture

The Node 24 PayTrace app runs on Azure App Service with SQLite for its single-instance sandbox demonstration. A separate Azure App Service hosts the reference course service and owns its entitlement database. The server keeps PayPal and Azure OpenAI credentials private. Render Workflow task definitions are in the repository for staged investigation and recovery. Isolated fictional investigation and merchant-approved recovery runs completed with model-backed consultation and a local lesson proof. On 2026-11-08 a PayPal sandbox purchase completed a connected recovery on the hosted app; its run report recorded all six connected checks, including the Render recovery run and the protected lesson. Optional encrypted Azure Blob backup copying is implemented but not configured. This architecture is a sandbox prototype, not a production multi-merchant deployment.

## Testing Instructions

1. Open the [judge walkthrough](https://paytrace-recover-sagitta.azurewebsites.net/judge.html) and follow the labeled fictional sample.
2. Open the [merchant workspace](https://paytrace-recover-sagitta.azurewebsites.net/focus.html). The Connections view shows which providers are configured; configuration is not an end-to-end pass.
3. For a connected test, create a sandbox case, complete a PayPal sandbox buyer checkout, run investigation, inspect the cited findings, rehearse and approve the exact grant, apply it, then verify the protected lesson. Download the run report and open the private customer tracker.
4. Locally, use Node 24: `npm ci`, `npm test`, and `npm run test:coverage`. CI gates 87% line and 81% branch coverage as a floor. The 90% review target is still open.
5. Run `npm run hosted:preflight -- https://paytrace-recover-sagitta.azurewebsites.net/` to check public routes and provider configuration. It does not prove a checkout or grant.

## Public Demo Link

https://paytrace-recover-sagitta.azurewebsites.net/judge.html

## Public Repository Link

https://github.com/sagitta414/paytrace-recover

The feature and security-fix [PR #3](https://github.com/sagitta414/paytrace-recover/pull/3) was merged into public `main` as commit `6850345`. The later `2409dec` simplification and `b6904d0` case/customer clarity updates are deployed to the Azure sandbox demo. `/health` and the changed public page assets returned HTTP 200 after the latest deployment. An earlier SQLite database integrity failure was repaired into a separate checked copy; managed storage remains a pilot requirement. The 2026-11-08 connected sandbox recovery is shown in the demo video; its redacted run report is not yet saved in this repository.

## Demo Video

TODO: A 2:19 cut is recorded but not uploaded. Finalize it using the [video review](docs/video-review-2026-11-10/VIDEO_REVIEW_2026-11-10.md), upload it publicly to YouTube, and put its URL in the submission form. Show the product functioning in a browser. Suggested sequence: buyer sees a locked lesson after payment; merchant opens the case and checks PayPal/course evidence; four specialists explain their recommendation; merchant approves one narrow grant; protected lesson opens; customer sees the update and confirms. Show the run report's connected/demo labels and avoid implying Render ran until a real Workflow run is captured. Use only media and marks you have permission to include.

## Screenshot Shot List

1. Judge page showing the problem and honest readiness labels.
2. Merchant case showing the readiness checklist, next action, and payment/access mismatch.
3. Four specialist findings and objections tied to sources.
4. Exact before/after grant preview and approval control.
5. Compact technical outcome, protected-lesson proof, Recovery Passport, and the latest merchant update on the customer page.

## Submission Readiness Notes

The code-level security fixes passed CI and are merged into public `main`. The paired Azure apps were updated on 2026-11-02. On November 4, the PayTrace database failed integrity checking and caused `/health` to return 503. A separate SQLite rebuild passed integrity checking and matched row counts in all 39 application tables; Azure now uses that copy. The `b6904d0` UX deployment passed its health and changed-asset checks. These checks do not prove that a complete connected recovery works. The connected run on 2026-11-08 reported 6/6 connected checks. Save its redacted run report and Render run IDs with the filled acceptance record before submitting.

## Known Limitations

- One PayPal-connected sandbox recovery completed on 2026-11-08 with 6/6 connected checks in its run report. It is a single run. The filled acceptance record, the `npm run acceptance:check` result, and the redacted report are not yet saved in this repository.
- On 2026-11-10 a fresh browser session of the hosted workspace showed no cases and "Full end-to-end proof pending." A judge sees connected proof only after running their own sandbox checkout.
- The encrypted backup restore probe passed locally on Azure App Service storage; independent off-site copy and remote restore drill are pending.
- Current all-files coverage is about 87% lines and 82% branches, below the 90% review target.
- The public merchant workspace is a sandbox demo; verified merchant OIDC and a commercial LMS integration are not configured.
- The Azure demo database uses SQLite on App Service shared storage. It recovered from a November 4 integrity failure, but a managed transactional database is needed before a merchant pilot.

## Official Submission Check

The [event overview](https://paypalaihackathon.devpost.com/) and [official rules](https://paypalaihackathon.devpost.com/rules) list a deadline of **November 12, 2026 at 12:00 p.m. Pacific**. The entry needs a functional demo or complete local run instructions, a public open-source repository with source and license, a text description explaining features and tools, and a public YouTube demo video under three minutes. This repository has an MIT `LICENSE`, source, and local run instructions; the hosted demo is live. The video is recorded but not yet uploaded to YouTube. Confirm the form's exact fields, team information, and any sponsor-specific requirements in Devpost before submitting. This is a draft, not a submitted entry.

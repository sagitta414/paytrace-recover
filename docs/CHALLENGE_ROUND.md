# Agent challenge round

The decision card sits beside the merchant action on desktop. Mobile puts the next action first, then the review. Opening the card reveals categorized objections, their resolutions, a short exchange, and clickable records from the reviewed snapshot.

## Decision rules

- Ready: exact completed payment, order, learner, course, amount and currency agree; access is missing; no open objections. Rehearsal and merchant approval are still separate requirements.
- Needs evidence: the sample payment record is unavailable, or the model leaves an objection unanswered. No repair is available.
- Blocked: an exact purchase check fails. A model cannot override this result.
- Verify only: access already exists for the exact payment, learner and course. Verification makes zero repair writes and requires no repair approval.
- Stale: the evidence fingerprint changes. Prior review, preview and approval cannot authorize a new write. Source links still show the original reviewed snapshot.

The review does not establish the root cause of the injected timeout. That uncertainty remains visible. A resolved objection is not proof of a completed correction or a durable outcome.

## Model adapter

Without configured credentials, the server and public site label the dialogue scripted. With an operator-unlocked API key and explicitly configured model, the server makes at most six Responses calls: three specialist findings, Prism's 1–3 objections, Ledger's single evidence response using payment and store records, and Prism's per-objection decision. Source IDs, categories, unique objection IDs, required answers, status values and text lengths are validated. No second debate loop or automatic repair follows.

Code recomputes mandatory checks when attaching the model result. It retains deterministic objections, and any open model objection adds a hold. Invalid, refused, incomplete or failed model output leaves the stored case in an incomplete-review state, never a scripted fallback that permits repair. Agent characters are roles sharing one configured model, not independent external experts.

Schemas follow [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Source-ID validation does not verify factual accuracy; inspect the actual claims during live acceptance testing.

## Demonstration

1. Case A: investigate; expand the review; inspect a payment citation; rehearse, approve, repair, then open the lesson. One access write.
2. Case B: investigate the wrong order. The identity objection remains open; rehearsal is unavailable.
3. Case D: investigate missing payment evidence. Supply the sample record, then run a fresh investigation before rehearsal.
4. Case E: investigate access restored by the store's earlier retry. Choose Verify existing access. Confirm zero access writes.
5. Case F: investigate, rehearse and approve. Use Demo: change the payment reference. Approval is cleared; a fresh review blocks the mismatched reference.
6. Case C: repeat the normal repair; verification fails once. Retry verification without repeating the correction.

## Validation and limits

Automated tests cover each decision path, stale snapshots, lost objections, live-review failure, six-call bounds, model non-mutation, exact-check precedence, and the server zero-write verification path. API and Render tests use mocks. PayPal, OpenAI and Render have not been configured or tested live.

The public website is a browser simulation. The backend uses a sample entitlement store and a lesson-access endpoint; it is not connected to an external learning platform. The existing Render integration still needs operational acceptance testing, including abandoned-run handling and retry behavior. No production readiness claim is made.

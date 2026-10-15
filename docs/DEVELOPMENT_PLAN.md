# PayTrace Recover development plan

Build a working sandbox product that resolves one concrete problem: a customer paid through PayPal but cannot open the course they purchased. Render executes the investigation and approved recovery. AG Studio gives the merchant an interactive evidence workspace. Success means the correct learner can retrieve protected course content after one approved repair, with a record of the checks performed.

This plan covers a hackathon deployment first, followed by a merchant pilot. It does not authorize production payments or paid resource provisioning. Planning estimate: 10–15 focused engineering days after credentials and trial access are available, plus contingency for provider integration. This is an estimate, not a delivery commitment.

## Current baseline

- Existing: responsive static demo, nine scenarios, agent challenge round, rehearsal, approval, recovery receipt, shared recovery rules, Node 24 backend, SQLite persistence, and automated tests.
- Prepared but not validated end to end: PayPal sandbox adapter, live AI review adapter, and Render investigation and recovery tasks.
- New work: AG Studio integration, separate merchant and learner identities, protected content delivery, stronger workflow recovery, and deployed integration evidence.
- Current limitations: case ownership follows a demo cookie session; writes use an in-process lock; verification calls the same application's access predicate; lesson content is present in the frontend demonstration. These are not sufficient for the proposed customer-side verification claim.
- Current publishing: Sites serves the static simulation. The Render deployment will be a separate backend-enabled application until its public URL is deliberately adopted.

## Product scope

The first release serves one demonstration merchant, one course, and controlled learner accounts. It supports payment confirmed but enrollment missing, wrong purchase reference, missing evidence, already-restored access, changed evidence after review, and verification failure.

The signature interaction is an evidence workspace: select a case, see payment and access events together, inspect agent findings, rehearse the correction, approve it, and inspect the verification receipt. A merchant can ask which other demonstration cases share an observed failure signature; the result filters the workspace without authorizing bulk repairs.

Memberships, downloads, automatic refunds, payouts, arbitrary browser repair, multiple LMS connectors, and KERNEL are outside the first release. Similar events are leads for investigation, not proof of the same root cause.

## Architecture and responsibilities

| Component | Responsibility |
| --- | --- |
| React and AG Studio workspace | Case selection, custom evidence widgets, linked filters, read-only investigation questions, mobile case summary |
| Node API on Render | Identity, case ownership, payment checks, approvals, authorized actions, protected content, audit records |
| Render Workflows | Gather evidence, run specialist analysis, record findings; separately execute approved repair and verification |
| PayPal sandbox | Checkout, capture, authoritative fresh payment evidence |
| AI provider | Interpret supplied evidence, explain uncertainty, challenge a proposed repair, produce cited structured findings |
| Database | Cases, evidence versions, approvals, workflow status, repair uniqueness, verification records |

The browser never receives provider secrets or direct repair authority. AG Studio tools may inspect cases and change views; all mutations go through the API. Model output cannot override payment, identity, scope, or approval checks.

For the controlled demo, retain SQLite on a persistent disk with one web instance, but add transactional repair uniqueness and durable job records. Workflow tasks call the API instead of opening its database file. Move to shared Postgres before multiple web instances or a merchant pilot.

## Account setup

| Owner | Task | Ready when |
| --- | --- | --- |
| User | Create Render account, connect accessible Git repository, claim available hackathon credits | Repository access is connected and proposed service costs reviewed |
| User | Request AG Studio trial | Trial license is available and expiration covers the intended demo or an extension is arranged |
| User | Create PayPal sandbox app and buyer/business test accounts | Sandbox client ID and secret are configured server-side |
| User | Configure AI provider key and an available model | Key and model are configured server-side |
| Development | Prepare environment template and deployment configuration | Required variables, service boundaries, and setup steps are documented without secret values |

Local UI, case contracts, and automated verification can proceed while accounts are being configured. A phase dependent on a live provider remains unverified until the actual service succeeds; a mock is not a replacement for that acceptance check.

## Build sequence

### Phase 1 Validate the integration path

Estimate: 1 day.

- Run the existing test suite and record the baseline.
- Create a small AG Studio integration using a selected case and two linked data sources. Establish custom-widget and agent integration APIs against the installed package version.
- Validate the installed Render SDK and task registration against current documentation. Complete a minimal task run when the account is available.
- Confirm the existing AI adapter can return valid structured findings with the configured model.

Acceptance: a Studio widget renders and filters real fixture data; a Render task run completes with a recorded run ID; the configured model returns a valid cited finding. Record each independently so account delays are visible.

Verification: `npm test`, a local browser check, and saved provider run results without secrets.

### Phase 2 Establish case ownership and safe persistence

Estimate: 1–2 days.

- Introduce stable merchant, learner, purchase, and case IDs independent of browser session IDs.
- Add separate authenticated demonstration merchant and learner sessions. Merchant access is restricted to its cases; learner access is restricted to its purchases.
- Persist evidence revisions, approval records, workflow jobs, and a unique repair operation per purchase and entitlement.
- Enforce the evidence version and approved change inside the repair transaction. Repeated requests return the existing operation result.
- Move shared business rules out of the published asset directory into a maintained source module, preserving the static demo through the build.

Acceptance: a second account cannot read or mutate another account's case; duplicate requests and process restarts do not grant access twice; changed evidence invalidates approval.

Verification: integration tests for identity boundaries, concurrent duplicate requests, stale approval, and restart persistence.

### Phase 3 Complete the PayPal and course access path

Estimate: 1–2 days.

- Complete one sandbox checkout and capture using the existing adapter.
- Bind the merchant's purchase reference to the correct learner and course; payer email alone is not learner identity.
- Inject a clearly labeled failure in our own enrollment service after successful capture.
- Deliver actual lesson content through an authenticated protected endpoint. Remove protected content from publicly downloadable assets.
- Fetch fresh payment evidence before repair. Missing, inconsistent, refunded, reversed, or otherwise unsupported payment state must block the correction rather than imply eligibility.

Acceptance: the actual sandbox purchase has one capture, the learner initially receives a denied response for protected content, and a mismatched purchase cannot qualify for repair.

Verification: sandbox dashboard evidence plus authenticated HTTP checks. Do not describe the controlled enrollment failure as a PayPal outage.

### Phase 4 Make recovery workflows reliable

Estimate: 2 days.

- Deploy the web service and separate investigation and recovery workflow tasks.
- Investigation ends with a stored decision awaiting merchant review. Recovery starts only after server validation of the exact approval.
- Give each stage durable progress and retry semantics; persist completed results so retries do not unnecessarily repeat AI calls.
- Correct timeout budgets: six sequential calls allowing 45 seconds each can exceed the current 240-second callback timeout. Split analysis stages or use a coherent total deadline and stage budgets.
- Add job expiry and reconciliation so interrupted callbacks or abandoned runs do not leave cases permanently pending. Refresh the UI from persisted job state.
- Retrying verification must perform reads only, without applying another repair.

Acceptance: leaving the page does not lose recovery progress; a simulated timeout produces a recoverable status; replayed callbacks cannot overwrite newer evidence; unapproved repair attempts fail.

Verification: fault-injection tests, actual Render run history, and a restart during an active case.

### Phase 5 Build the AG Studio merchant workspace

Estimate: 2–3 days.

- Add a React workspace and documented build command to the existing Node application.
- Create custom widgets for payment-to-access events, cited evidence, repair preview, and verification receipt.
- Connect case selection and filters across widgets, including the related-case view.
- Integrate Studio's agent framework with a scoped server-side AI endpoint. Questions may inspect permitted evidence and adjust views; they cannot approve or execute repairs.
- Preserve PayPal blue styling, fictional agent portraits, keyboard navigation, useful empty/error states, and a clear mobile summary with expandable evidence.
- Make scripted demo, live AI, and sandbox payment states visibly distinguishable.

Acceptance: selecting a case updates all widgets without mixing evidence; a natural-language request filters supported related cases; citations open the correct evidence version; mobile approval remains readable and usable.

Verification: desktop and mobile browser walkthrough, keyboard use, error states, and a scoped-data test for agent queries. Document actual sponsor features used.

### Phase 6 Verify the customer outcome

Estimate: 1–2 days.

- Apply the approved correction through the entitlement interface.
- Verify access through a separate authenticated learner request to the protected content endpoint, rather than calling the repair function's own access predicate.
- Check learner identity, course ID, response status, and expected content identifier. A screenshot alone cannot establish success.
- Leave failed or unavailable checks in a visible verification-pending state.
- Export a recovery receipt containing the payment reference, evidence revision, proposed change, approval, repair operation ID, workflow run IDs, verification result, and timestamps.

Acceptance: before repair the authorized learner cannot retrieve content; afterward that learner can retrieve the purchased content while an unrelated learner remains denied. An already-restored case performs zero repair writes.

Verification: end-to-end tests of successful recovery, wrong learner, already-restored access, and failed verification followed by a read-only retry. For this release, verification is a separate client check of our demo course service, not an independent third-party LMS audit.

### Phase 7 Deploy and prepare the demonstration

Estimate: 1–2 days.

- Validate Render environment configuration, persistent storage, health checks, HTTPS session behavior, and bounded access to operations that incur provider costs.
- Run the complete sandbox acceptance flow on the deployed URL and inspect public assets for accidental secrets or protected content.
- Confirm AG Studio license coverage and record dependency versions.
- Record one successful recovery and one correctly blocked case; measure elapsed recovery time instead of making unsupported savings claims.
- Update README and setup documentation to distinguish verified integrations from simulations.
- Prepare a public source repository with an appropriate license, screenshots, and a concise demonstration video after confirming current submission requirements.

Acceptance: a reviewer can follow the setup instructions or use the controlled deployed demonstration, understand all three integrations, and inspect an actual recovery receipt. Only verified provider behavior is presented as working.

## Release checks

- [ ] PayPal sandbox purchase and fresh payment reads verified.
- [ ] Live AI investigation uses cited evidence and preserves uncertainty.
- [ ] Render investigation and recovery runs complete with recorded IDs.
- [ ] AG Studio custom widgets, linked filtering, and agent interaction work.
- [ ] Merchant approval is enforced by the server and bound to current evidence.
- [ ] Duplicate repair attempts produce at most one entitlement grant.
- [ ] Protected content is unavailable before repair and available to the correct learner afterward.
- [ ] Wrong learner and mismatched purchase remain blocked.
- [ ] Failed verification remains pending and retries without another grant.
- [ ] Workflow interruptions recover without a permanently stuck case.
- [ ] Mobile and keyboard flows work; configured and simulated modes are clear.
- [ ] Deployment, trial coverage, setup instructions, and demonstration evidence are ready.

## Pilot after the hackathon build

Validate the problem with three merchants or support operators before expanding integrations. Select one real course platform with supported enrollment and access-read APIs. Replace demonstration identity with production merchant and learner authentication; migrate to shared Postgres; add verified PayPal webhooks, replay handling, periodic reconciliation, refund and revocation policies, retention controls, and operational monitoring.

Track verified access restorations, time to resolution, manual touches, and cases requiring escalation. Treat avoided refunds and support savings as hypotheses until measured. Confirm continuing AG Studio licensing and hosting/provider costs before the pilot.

## References

- [Render hackathon resources](https://paypalaihackathon.devpost.com/details/render)
- [Render Workflows](https://render.com/docs/workflows)
- [AG Studio hackathon resources](https://paypalaihackathon.devpost.com/details/aggrid)
- [AG Studio React quick start](https://www.ag-grid.com/studio/react/quick-start/)
- [AG Studio trial and licensing](https://www.ag-grid.com/studio/license-pricing/)
- [Existing integration setup](SETUP.md)
- [Existing product scope](PRODUCT.md)
- [Existing challenge validation](CHALLENGE_ROUND.md)

## Implemented prototype update

The five-improvement update adds delivery-window monitoring of saved purchases, cause-specific routing, related-case filtering, a scoped authenticated HTTP content probe, and editable customer-response templates. The custom console is operational; AG Studio is still planned. The Node content probe verifies our demo service, not an external LMS. Production identities, cross-instance coordination, external webhooks, and actual PayPal/AI/Render acceptance runs remain outstanding. See README and SETUP for current behavior and limits.

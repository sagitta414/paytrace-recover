# Integration setup

The public Sites page deliberately uses sample records. To use live test services, deploy or run the Node app from this repository. Never put secret keys in `dist/`, browser code, public form fields, Git, or screenshots.

## 1. Local server

Install Node 24+, run `npm ci`, copy `.env.example` to `.env`, then `npm start`. Keep `PUBLIC_URL` equal to the exact browser origin (default `http://127.0.0.1:4358`). Set a private random `DEMO_OPERATOR_KEY` of at least 32 random bytes. The developer disclosure under the desk unlocks configured integrations for that one cookie session. Without it, visitors can run sample cases without model or workflow costs.

This is a controlled demonstration gate, not merchant identity or tenant authentication.

## 2. PayPal sandbox

Create a sandbox REST application and sandbox business/personal test accounts in the [PayPal developer dashboard](https://developer.paypal.com/dashboard/). Configure `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in the server environment. Use sandbox credentials only. The server hardcodes `api-m.sandbox.paypal.com`; no production API option exists.

Restart the server, unlock the operator session, and choose **Restart story**. In the learner storefront use the optional PayPal sandbox button (the separate sample-checkout button is a simulation). Sign in using the sandbox personal buyer, approve the $128 test purchase, and return to the app. The server creates an order with this session's purchase reference, captures it with a stable request ID, persists the capture, and deliberately leaves the entitlement locked.

Run investigate → rehearse → approve → apply & verify. Open the lesson. Confirm in the sandbox dashboard that only the original capture exists. A fresh order GET and capture GET supply verification evidence. The merchant's internal order binds learner and course; the PayPal payer is not used as a learner-identity claim.

There is no webhook receiver yet. This prototype uses the explicit checkout/capture path and injects a failure in its own entitlement update. Do not describe its sample timeout as a PayPal delivery failure. Production event processing would require verified webhooks and replay handling.

Reference: [Orders walkthrough](https://developer.paypal.com/checkout/put-it-all-together/), [Payments v2](https://developer.paypal.com/api/payments/v2/).

## 3. AI review

Configure `OPENAI_API_KEY` and `OPENAI_MODEL` with a Responses API model that supports Structured Outputs in your account. No model is silently selected. Restart, unlock the operator session, and investigate a case. The server performs four role-specific calls, passes prior findings to later reviewers, and validates source identifiers against the supplied records. The UI must say **Model-generated findings**. Missing credentials produce explicitly labeled scripted samples.

Only the fictional transaction, course, entitlement, log, and prior findings are sent. Requests use `store:false`; provider retention policies still apply. No API tool enables money movement or access writes. An incomplete/invalid response surfaces an error instead of inventing success. Record latency and inspect factual claims against source records before demonstrating.

Reference: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

## 4. Render web service

Put the source in a Git repository available to your Render account. The existing Sites Git remote is managed by Sites; connecting Render requires a repository Render can access. The supplied `render.yaml` describes one Node web service and persistent disk. Review Render's current costs before creating resources; no Render service was created by this build.

Use build command `npm ci`, start command `npm start`, Node 24+, and `DATABASE_PATH=/var/data/courselatch.sqlite`. Set `PUBLIC_URL` to the web service's exact HTTPS URL. Configure secrets through Render's environment settings. Keep one web instance because the SQLite database and session lock are local to it.

## 5. Render Workflows

Create a Workflow service from the same repository following [Render's workflow setup](https://render.com/docs/workflows). Use build command `npm ci` and start command `npm run workflows`. The JS entry point uses the official `@renderinc/sdk/workflows` task API; the lockfile pins the installed SDK. Set the workflow's `APP_URL` to the deployed web URL. Set the same random `WORKFLOW_SECRET` on both services.

Registered tasks: `gatherEvidence`, `consultSpecialists`, `recordFindings`, `applyApprovedRepair`, `verifyLearnerAccess`, and the two root tasks `investigate` and `recover`.

On the web service set `RENDER_API_KEY` plus `RENDER_INVESTIGATE_TASK` and `RENDER_RECOVER_TASK` to the exact task slugs displayed by Render (workflow slug + task name). Unlock the operator session. Investigation dispatches a task run that gathers records, calls the specialists, and records results. It ends before merchant approval. After rehearsal and approval, **Apply & verify access** starts a separate recovery run.

Record the successful Render run IDs and show both task chains during the demo. Do not claim a working sponsor integration until actual runs complete. UI polling lasts one minute; longer tasks can be checked by refreshing the page. Workflow retries reuse the case job ID; stale jobs cannot modify a new case. A failed verification keeps the case open and retries reads without granting access again. If a provider call fails, inspect that run and the app error before retrying. The sample has no automatic abandoned-job recovery daemon.

Reference: [task definitions](https://render.com/docs/workflows-defining), [running tasks](https://render.com/docs/workflows-running), [Blueprint specification](https://render.com/docs/blueprint-spec).

## Live acceptance checklist

- Sandbox checkout completes and creates one capture; learner remains locked.
- Four model-generated findings contain valid, accurate citations and preserve unknowns.
- Render investigation ends before approval; recovery cannot begin without it.
- Rehearsal changes only a copy. Fresh evidence changes invalidate approval.
- The correct purchase unlocks one entitlement, fresh verification passes, and the lesson opens.
- Conflict case stays locked. Failed-read case stays unverified until retry; access-write count remains one.
- Capture provider request/run IDs and screenshots with secrets excluded. Date this evidence and update README's integration status only after success.

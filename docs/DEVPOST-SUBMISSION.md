# Devpost submission draft

Prepared text, not a submitted entry. Keep the testing disclosure until fresh connected evidence is recorded.

## Project title

PayTrace Recover

## Tagline

Payment confirmed. Access checked. Every correction backed by evidence.

## Inspiration

A successful payment can still leave a customer locked out of the course they bought. The buyer sees an unfinished purchase; the merchant sees a completed transaction. We wanted to connect those two views and give merchants a controlled way to restore the exact access that was purchased.

## What it does

PayTrace Recover investigates paid-but-missing-access cases using PayPal sandbox payment evidence and a separate course-access record. Four AI specialists examine the purchase: Ledger checks payment, Relay traces events, Patch proposes the smallest correction, and Prism challenges the conclusions.

The merchant inspects source evidence and rehearses an exact entitlement change before approving it. Changed evidence invalidates approval. The backend applies the correction idempotently and independently checks payment, entitlement and protected lesson access. Verification retries reread those sources without repeating a grant.

A source-linked Recovery Passport separates payment, investigation, approval, correction, lesson proof, buyer-browser receipt and customer confirmation. Private customer links support progress updates, messages and a separate success or help response. Sample stories are fictional; run reports distinguish connected, demo and incomplete evidence.

## How we built it

Node.js 24, browser JavaScript and SQLite power the application. Shared deterministic recovery rules gate changes. Server adapters integrate PayPal sandbox checkout, fresh capture reads and verified webhook triggers. An AI Responses endpoint supplies cited specialist reviews; Azure OpenAI is supported through its v1 endpoint. A separate reference course service supports purchase-scoped entitlement operations and protected-content probes.

Optional Render Workflows separate investigation and recovery stages. Optional email, OIDC/MFA membership, role boundaries, durable jobs, audit records and encrypted backup tooling support the surrounding workflow.

## Challenges

Payment success, an access write and customer satisfaction are different events. We needed to prevent duplicate corrections, invalidate stale approvals, hold mismatched identities and avoid presenting old passing checks as current proof. We also needed a clear boundary between scripted samples, configured integrations and completed connected recovery.

An earlier Azure database health failure required a preserved-copy repair. Route and health checks then demonstrated availability, and on 2026-11-08 a PayPal sandbox buyer-to-lesson recovery completed with all six connected checks in its run report.

## Accomplishments

The repository implements evidence-led investigation, explicit approval, idempotent correction, expiring lesson proof and a private customer evidence trail. Automated local/mocked tests exercise mismatches, stale evidence, authorization, private data, retries, intake and reporting. Consult the latest submission status for exact test results and remaining provider checks.

## What we learned

The hard part is knowing when evidence is sufficient to act and when it is not. Merchants need the next safe action; customers need a clear answer and a way to say whether access works. AI interprets evidence while deterministic checks and merchant authorization control consequential changes.

## What's next

Repeat the connected sandbox acceptance with saved redacted evidence, validate identity and email with configured providers, and test the simplest merchant flow with unfamiliar users. Validate a commercial course-platform adapter before claiming support for it.

## Tools disclosure

- PayPal Developer Platform: sandbox checkout/capture, authoritative reads and verified webhook triggers. Shared-account reporting discovery is paused until purchases can be scoped to one merchant.
- AI Responses API: specialist findings, challenge/response reviews and read-only follow-ups. Enter the actual provider/model deployment used in the recorded run in Devpost; scripts are not model execution. The 2026-11-08 run report shows `gpt-4o-mini`.
- Azure: App Service hosting, Azure OpenAI specialist runtime and Application Insights traces. A passing health check is not connected recovery proof.
- Render: optional task integration. Describe it as executed only when a saved run proves it. The 2026-11-08 run report records the Render recovery stage as connected.
- Node.js 24, JavaScript, HTML/CSS, SQLite and JOSE: application, persistence and token verification. Optional Resend provides notifications.
- OpenAI Codex assisted with code, tests and documentation; maintainers review the result and evidence.

Do not list sponsor tools that are not integrated. Never include production credentials.

## Submission links

- Source: https://github.com/sagitta414/paytrace-recover
- Judge instructions: [README](../README.md) and [judge testing](JUDGE-TESTING.md).
- Hosted sandbox demo: https://paytrace-recover-sagitta.azurewebsites.net/judge.html (recheck health before recording or submitting).
- YouTube: enter the real Public video URL after recording/upload. A 2:19 cut exists locally and is not yet uploaded.

## Testing disclosure

The walkthrough uses fictional records and scripted specialists. The working Node backend and provider adapters exist. Local/mocked tests do not establish external acceptance. One connected PayPal sandbox recovery completed on 2026-11-08 with 6/6 connected checks; it is a single run, not repeated acceptance. Update the [integration status](INTEGRATION-STATUS.md) after actual connected tests; do not replace missing results with claims.

# PayTrace release candidate

This branch prepares a verified merchant mode and a repeatable connected acceptance check. It has not passed live PayPal sandbox and Render Workflow acceptance until the steps below are run with the user's private provider accounts. Keep `main` and the existing public demo unchanged until that evidence exists.

## Identity and workspace boundary

Use an OIDC provider that supports authorization code + PKCE, signed ID tokens, verified email, and MFA claims. Configure `AUTH_REQUIRED=true`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, the optional confidential-client secret, and `BOOTSTRAP_ADMIN_EMAILS` in private hosting settings. Configure `PUBLIC_URL` as the exact HTTPS origin and register `/auth/callback` as the redirect URI. The account page is `/account.html`. Merchant passwords and MFA enrollment stay with the identity provider.

When verified mode is required, `cl_session` demo cookies and `pt_team` bearer links cannot access merchant APIs. A bootstrap admin gets a new empty workspace; existing demo cases remain isolated. Invite members by verified email from Recovery Center → Team access. Production startup also requires the separate course connector. Do not turn on verified mode on the existing demo deployment before configuring OIDC and the connector; it intentionally fails closed.

## Chosen course connector

Keep the current `COURSE_ACCESS_URL` and `COURSE_ACCESS_API_KEY` adapter and the four `/v1/access/*` operations documented in [COURSE-ACCESS.md](COURSE-ACCESS.md). The reference course service can serve the sandbox run. A commercial LMS integration must honor the same purchase identity, grant idempotency key, protected-content probe, and exact-capture suspension. Do not substitute an account-wide enrollment toggle for purchase-bound suspension.

## Connected acceptance sequence

1. Configure the PayPal **sandbox** client ID and secret, the matching webhook ID, the course service, the AI model, and Render Workflow secrets on the server. Use private hosting settings; never put secrets in the browser or repository. Run connection checks, which prove reachability only.
2. Sign in as a verified Admin or Manager. Create one **sandbox** case, complete a PayPal sandbox checkout with a sandbox buyer, and inspect the fresh captured order, learner, course, amount, and currency. Do not use a sample case.
3. Run the four-specialist model review, inspect citations and objections, rehearse the exact access grant, then approve it as the merchant. Run the separate Render recovery task. Check that the course service recorded one grant and that the protected lesson opens.
4. Select that case in the merchant desk. In a private shell, set `PAYTRACE_ACCEPTANCE_URL`, `PAYTRACE_ACCEPTANCE_CASE_ID`, and `PAYTRACE_ACCEPTANCE_COOKIE` (one `pt_account=…` or `cl_session=…` cookie). Run `npm run acceptance:check`. It refreshes the case from the backend and requires all six report checks, one grant, a fresh external lesson proof, and no payment hold. It prints only booleans and case ID, never the cookie, buyer details, or provider reference.
5. Test a protected-lesson failure and read-only verification retry. Run the checker with `PAYTRACE_ACCEPTANCE_MODE=failed-verification` while the failure is present. It requires exactly one existing grant and no verified claim.
6. Deliver a signed sandbox refund/reversal webhook for the exact capture. Confirm the payment hold and external access suspension, then run with `PAYTRACE_ACCEPTANCE_MODE=refund`. The checker requires a recorded webhook signal, inactive entitlement, and no verified claim. Test a duplicate delivery and a mismatched capture separately; neither may create a second grant or suspend a different purchase.
7. Test one interrupted email delivery with a test recipient, confirm the same message/idempotency key is retried, and inspect the customer portal: progress, a merchant update, customer reply, and reopened help. Save a redacted run report and screenshots for judges.

The checker is intentionally **read-only for payment and access**. It does not perform checkout, approve a grant, trigger a refund, or send email. A pass is evidence for that moment; it is not proof of future access or customer confirmation. If credentials or Workflow service are not configured, the connected steps remain pending and must not be claimed as completed.

## Judge route

Open `/judge.html`. The guided sample shows the intended customer and agent story; the merchant desk shows current records; Recovery Center shows analytics, history, receipt, audit, and operations. The six-signal evidence trail explains which saved checks constitute a connected sandbox run. Keep the sample and connected case labels visible in screenshots and video.

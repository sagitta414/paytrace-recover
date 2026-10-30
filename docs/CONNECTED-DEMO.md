# Connected demo checklist

Start at `https://paytrace-recover-sagitta.azurewebsites.net/judge.html`. The sample tour is clearly labeled fictional. The Azure merchant workspace is server-backed, but its current integration state is **AI connected, separate course service connected, PayPal sandbox unconfigured, Render Workflow unconfigured**. A recovery run is connected only when the run report records all six checks as passed.

The judge page now gives one short route through the sample story and a separate server-backed case, then points to the connection checklist for a sandbox run. The Focus dashboard's outcomes panel counts current verified access, evidence holds, and writes awaiting verification. On the server it also counts technically verified cases without a recorded customer confirmation. These are this workspace's cases, split by sandbox versus sample; they are not a claim about merchant-wide impact.

## 1. Connect the PayPal sandbox app

In PayPal Developer Dashboard, open the existing **Sandbox** REST app. Copy its client ID and client secret into Azure Portal → App Services → `paytrace-recover-sagitta` → Environment variables → App settings as `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Save and allow the app to restart. Do not put either value in the browser, GitHub, a screenshot, or a chat message. Use credentials from the same sandbox app; live credentials are not supported by this prototype.

Return to `/focus.html?screen=connections` and check that PayPal is **Configured · not checked**. Create a **sandbox** case, use its checkout, and confirm PayTrace rereads the exact completed capture. A sample case is not a PayPal test. For webhook intake, register `https://paytrace-recover-sagitta.azurewebsites.net/api/paypal/webhook` for `PAYMENT.CAPTURE.COMPLETED` in that sandbox app and save its webhook ID as `PAYPAL_WEBHOOK_ID` in Azure. The app also performs fresh reads, so a webhook is not required to begin the checkout test.

## 2. Use the separate course service

`paytrace-course-sagitta` is already deployed on the existing Azure plan. Its private key is held in both Azure apps' environment variables. A fictional unauthenticated request returned 401; an authenticated adapter read returned inactive access with zero writes. The service stores its own demo entitlement database. Only sandbox-mode PayTrace cases use this external service; a sample case uses local demo access.

## 3. Check the four AI specialists

The Azure app is configured for the existing `gpt-4o-mini` deployment. `npm run ai:eval` uses five fictional cases and prints expected versus actual outcomes, open objection categories, and write count. On 2026-10-24, all five outcomes matched: eligible missing access, wrong order, missing payment record, existing access, and wrong learner. AI can still vary; inspect the saved citations and rerun evaluation after prompt or model changes. The model never approves a grant.

## 4. Add Render Workflows

In Render, create a Blueprint from the public repo and choose **`render-workflow.yaml`**, which defines only the Workflow service. The root `render.yaml` provisions another web app and disk. Set a shared random `WORKFLOW_SECRET` on Render and the Azure PayTrace app; use the configured Azure `APP_URL`. Create a Render API key for the Workflow runner and save it as `RENDER_API_KEY` only in the Azure app. Set `RENDER_INVESTIGATE_TASK` and `RENDER_RECOVER_TASK` to the exact task slugs shown by Render. Test an investigation run, then a separate recovery run after merchant approval. Render bills task compute; review its pricing before activating it.

## 5. Capture the judge proof

Use one sandbox case from checkout through the customer's protected lesson. The merchant must approve the previewed grant. Show the agent evidence panel, the visual recovery receipt, and the downloadable run report. The six connected checks are PayPal payment, separate access, model review, merchant approval, Render recovery, and protected lesson verification. Customer confirmation is a separate final step. If any check is demo or incomplete, describe the run honestly as a partial integration.

The [three-minute demo script](DEMO_SCRIPT.md) and [Azure setup](AZURE-DEPLOYMENT.md) contain the presentation and operational details. Never include API keys or the operator unlock key in a public video.

For the isolated verified-merchant release branch, follow [RELEASE-CANDIDATE.md](RELEASE-CANDIDATE.md). Its read-only `npm run acceptance:check` command validates a freshly selected case against the saved six-signal report; it does not perform a payment or access mutation.

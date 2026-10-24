# Azure demo deployment

The Node demo is hosted at `https://paytrace-recover-sagitta.azurewebsites.net/` on the existing Linux Basic B1 App Service plan `provenance-broker-plan` in resource group `provenance-pilot-rg`. It shares that plan's capacity with other apps. The attempted dedicated free F1 plan was rejected because this subscription has zero F1 VM quota; it was not created. The empty resource group from that attempt was removed.

The app uses Node 24 LTS, `npm start`, Always On, and `/home/data/courselatch.sqlite` for the single-instance demo database. Keep the app at one instance: SQLite and the in-process lock are not suitable for scale-out. The public Sites URL remains a browser simulation; the Azure URL serves the Node backend.

## Connected sandbox setup

All provider settings belong in Azure App Service **Environment variables**, never in source or browser code. Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and `PAYPAL_WEBHOOK_ID` from the same sandbox app. Add `https://paytrace-recover-sagitta.azurewebsites.net/api/paypal/webhook` as a `PAYMENT.CAPTURE.COMPLETED` webhook in the PayPal developer dashboard. Set `COURSE_ACCESS_URL` and `COURSE_ACCESS_API_KEY` to a separate HTTPS course service implementing [the contract](COURSE-ACCESS.md). Set `OPENAI_API_KEY` and `OPENAI_MODEL` for model-backed agent review. The Azure app already has a generated `DEMO_OPERATOR_KEY`; view or rotate it in App Service settings when you need to unlock a demo browser session. Do not share it in a public screenshot.

The four specialist roles use the existing Azure OpenAI `gpt-4o-mini` deployment on `automation-jl107`. The Azure App Service has `OPENAI_BASE_URL=https://automation-jl107.openai.azure.com/openai/v1/`, `OPENAI_MODEL=gpt-4o-mini`, and a server-side `OPENAI_API_KEY` configured. The four-call-role consultation was confirmed against the live Azure model on 2026-10-24. A local `npm run ai:smoke` check runs all four specialists against fictional evidence and reports the outcome without a repair. Prism can hold a case for more evidence; a model consultation alone does not establish a connected PayPal recovery.

To use Render Workflows while the web app is on Azure, configure `WORKFLOW_SECRET`, `RENDER_API_KEY`, `RENDER_INVESTIGATE_TASK`, and `RENDER_RECOVER_TASK` on the Azure web app. Configure the same `WORKFLOW_SECRET` and `APP_URL=https://paytrace-recover-sagitta.azurewebsites.net` on the Render Workflow service. No Render workflow service was created by this Azure deployment. Optional customer email requires `RESEND_API_KEY` and `EMAIL_FROM` from a verified sender.

## What the automation does

The 30-second monitor rereads **known** sandbox purchases. After the configured 1–60 minute delivery window, an exact completed PayPal capture with missing course access is marked for attention. If an operator session is unlocked and AI credentials are configured, it runs the four-specialist model review automatically, saves progress, and stops before merchant approval. Failed reviews are marked for attention and held for five minutes before another automatic attempt. The signed PayPal webhook can trigger the same check sooner. No automatic review grants access, sends a refund, or approves a correction.

After the merchant approves the exact preview, the existing recovery path applies a single idempotent access grant and verifies a protected lesson. Customer progress messages and optional email are queued from state transitions. A provider accepting email is not proof of inbox delivery. The Focus case screen shows the automation trail, while the run report labels connected versus demo evidence.

Unknown PayPal orders are acknowledged without creating cases. An external checkout or LMS must supply a trusted merchant, learner, course, and order mapping before PayTrace can create cases from unknown events. The current Azure app is a demo workspace with a cookie/operator gate, not production merchant authentication or multi-tenant storage.

## Validation

Check `/health`, load `/focus.html`, then complete a sandbox checkout and verify the exact case state. Confirm the webhook event and the fresh PayPal capture agree, missing access is detected only after the delivery window, AI review reaches **awaiting merchant**, approval is required, the repair is applied once, the lesson probe passes, and the customer tracker shows the new status. Export the run report. Until credentials are added and this run succeeds, do not claim a connected PayPal/AI/Render recovery.

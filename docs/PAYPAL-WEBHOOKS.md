# PayPal sandbox capture events

PayTrace can receive a `PAYMENT.CAPTURE.COMPLETED` event at `POST /api/paypal/webhook`. This is optional. It moves an already-created sandbox case from checkout to paid evidence and starts an access read. It never creates a repair, approves one, or grants course access.

In the PayPal Developer Dashboard, open the **same sandbox REST app** used by `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`. Add a webhook URL of `https://<your-backend-host>/api/paypal/webhook`, subscribe to `PAYMENT.CAPTURE.COMPLETED`, and save the resulting **webhook ID** as `PAYPAL_WEBHOOK_ID` in the backend environment. The webhook ID is different from the client ID. Use a publicly reachable HTTPS backend for a real PayPal delivery. The PayPal simulator's mock events cannot use PayPal's postback signature verification endpoint, so validate this flow with a real sandbox checkout made by the configured app. [PayPal's webhook setup and verification guide](https://developer.paypal.com/api/rest/webhooks/rest/).

For each event, PayTrace:

1. Preserves the event JSON, sends it with the transmission headers and configured webhook ID to PayPal's **sandbox** signature-verification API, and rejects a failed verification.
2. Uses the event's related order ID to find exactly one existing sandbox case. Unknown orders are acknowledged without creating a case.
3. Rereads that order and capture through the PayPal sandbox API. The capture ID, status, amount, currency, case reference, learner, and course must match the saved purchase.
4. Saves the confirmed payment, reads the course-access system, updates the delivery monitor, and records the event ID. Duplicate event IDs do not repeat the case update.

PayPal retries non-2xx webhook deliveries; PayTrace returns a retryable error if verification or fresh payment confirmation is unavailable. If course access is unavailable after payment is confirmed, the payment stays recorded and the case remains open for a later read. The regular access monitor still checks saved cases every 30 seconds while the server runs.

This is a sandbox proof of concept. The local tests mock PayPal's signature response and payment API; no live PayPal delivery has been accepted yet. A production version needs a durable queue for webhook processing, shared transactional deduplication across server instances, tenant isolation, event retention, and policies for refunds and revocations.

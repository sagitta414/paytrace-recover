# Customer progress and messaging

The merchant investigates and authorizes changes in `focus.html`. The customer uses `customer.html` to follow their own purchase, reply to information requests, open the verified demo lesson, and confirm success or ask for more help.

## Try it locally or on Render

1. Open the existing app and select a case in the Focus workspace.
2. Open `recover.html`, expand **Developer setup: unlock configured integrations**, and enter the configured `DEMO_OPERATOR_KEY`. Return to the Focus case. This unlocks only the current demonstration workspace.
3. In **Customer communication**, send a reply or choose **Request information**. Private admin notes never appear in the customer view. AI-assisted messages are explicitly labeled and require manual review; this panel does not call an AI model to write replies.
4. Expand **Customer link & email updates**. Use **Create private preview link**, then open the generated link in another tab. Treat it as a credential: anyone holding it can view that case, reply, and access the purchased demo lesson once verified. It expires after 24 hours and opens once; the resulting customer session also lasts 24 hours. Use **Revoke customer links** to end all links and sessions for the case.
5. Reply as the customer. Refresh the admin conversation. The request is answered without approving or changing access.
6. Investigate, preview, approve, and repair in the merchant workspace. Refresh the customer page. **Open my purchase** requires a current successful proof and checks the case-scoped protected course content again.
7. Customer confirmation is separate from technical verification. **I still need help** flags the conversation for follow-up without repeating an access grant.

The merchant can set a separate **Customer-visible update** time inside Customer communication. The private customer page shows that planned progress-update time and marks it overdue if it passes. It is not an access-restoration deadline, an automatic message, or the merchant's private follow-up reminder. Only an unlocked operator can set or clear it; the private reminder note never appears in the customer projection.

The tracker currently uses explicit **Refresh updates**. The visible check time distinguishes the displayed snapshot from a live stream. Draft text survives a conversation refresh; failed message retries keep their request ID to avoid duplicates during the current page session.

## Email setup

Configure server-only `RESEND_API_KEY` and `EMAIL_FROM` (a verified sender on your Resend account). The integration uses the [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email). Do not commit credentials. Use a test recipient you control while validating this sandbox demonstration.

In the admin panel, register an email only after matching it to the purchase record, then choose **Email private link**. The public lookup requires both that registered email and its order/case reference. Unknown purchases receive the same generic response. Lookup does not search PayPal transactions or an external store and cannot onboard an unknown order. The merchant must create/register that case first.

The server checks its durable outbox every five seconds. Progress changes, merchant replies, and information requests queue notifications when an email exists. The customer page remains usable with a manually shared private link when no email provider is configured.

Email activity states:

- `needs-email`: no registered recipient; nothing sent.
- `pending`: waiting for processing.
- `not-configured`: email credentials/sender missing; nothing sent.
- `sending`: an attempt began; a server interruption can leave this unresolved.
- `accepted-by-provider`: the provider accepted the request; **not proof of inbox delivery**.
- `failed`: provider rejected the attempt.
- `delivery-unknown`: network failure; receipt is uncertain.

There is no automatic retry of failed, unknown, unconfigured, or interrupted deliveries. After resolving setup, send a fresh invitation explicitly. Provider delivery/bounce webhooks and a richer retry console remain future work. Notification text and recipient are stored in SQLite; secret link tokens are hashed, and the link is created only for the send attempt. The provider request has an idempotency key.

## Boundaries and checks

- Separate HttpOnly customer cookie; customer endpoints derive workspace/case from its token, ignoring caller-supplied case IDs.
- All POST requests require the configured exact origin. Public customer requests have a conservative per-connection rate limit; repeated lookup email requests are cooled down.
- Operator unlock required for admin messaging, registering recipients, issuing/revoking links, and invitations. No changes to the existing approval requirements.
- Public projections omit payment identifiers, internal evidence, agent analysis, private notes, recipient email, and email-delivery logs.
- The admin manually verifies purchase/email association. A real store connector should provide the authoritative purchase email; the current app does not independently verify that manual association.
- Support records and tokens use the existing SQLite database. Use a persistent Render disk; an ephemeral database loses cases and conversations on restart.
- This remains a sandbox demo with isolated merchant sessions, not production merchant authentication. Before handling real customers, add real tenant identity, authoritative purchase-email lookup, retention policies, distributed abuse protection, and email delivery monitoring.

Run `npm test`. Support tests cover projection privacy, privilege separation, duplicate replies, scoped/expiring/revoked links, failed verification, reopening help, database restart, email result states, and HTTP origin/session enforcement.

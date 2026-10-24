# Purchase recovery, with proof and communication

Open `/story.html` for the guided interactive story. This is an explicitly labeled browser simulation: fictional customer, sample payment record, scripted specialist analysis, local lesson content, and no external messages. The Merchant/Customer toggle exists only in this demo. Actual customer access remains behind case-scoped links on `/customer.html`.

The public path is now **landing → guided customer story → merchant workspace → private customer tracker**. The landing page's main action opens the story. Its final handoff opens `/focus.html?from=story`: in browser mode, Maya's seeded `CL-1048` case opens; in server mode, the merchant chooses a server case from the queue. These are distinct demo states, so messages, approval, and verification do not transfer across pages. The actual customer tracker must be opened through a private case link created in the merchant communication panel.

For a PayPal sandbox case, create it in the Focus workspace and choose **Open sandbox checkout**. Checkout and operator unlock now stay on the selected case. After a sandbox capture, the case returns to evidence review; no access repair occurs without a separate merchant approval.

Each Focus case now opens with a **Case chapter**. It pairs the customer's current experience with the merchant's next safe action and links to the relevant evidence, decision, receipt, or communication panel. The chapter changes for an unconfirmed payment, reviewed evidence, merchant approval, applied correction, technical proof, customer confirmation, a blocked mismatch, an uncertain response, and a reopened help request. Customer confirmation comes from the private tracker in server mode; the public simulation never borrows that state.

The private customer tracker now shows **Technical access check** and **Your confirmation** as separate milestones. A help report changes the final milestone to **Follow-up open**. Its public landing page also links to the separate sample customer story for visitors who do not have a private case link.

The seven-chapter rail is derived from case state rather than a preset animation. It distinguishes the missing-access complaint, evidence, specialist challenge, merchant decision, one correction, fresh verification, and customer acknowledgement. The four specialist cards show their individual roles, source categories, and limits; the challenge round exposes the objections and how the sample evidence resolved or failed to resolve them. The final outcome panel deliberately separates a write, technical proof, and a human reply.

## Successful recovery

1. Start with the completed receipt beside the locked course and the illustrative customer complaint.
2. Choose **Follow this recovery**. Switch perspectives at any time to see the same case and its conversation.
3. As the merchant, review evidence. Explain the short decision brief: finding, proposed next step, control on the change, and uncertainty.
   The merchant also sees Relay's scripted customer-update suggestion. Preview it, then choose **Send this update** to add a human-approved message to the local conversation. The suggested wording changes as evidence, approval, and verification change; sending is never automatic and never emails anyone.
4. Preview the correction, explicitly check approval, then approve. Apply and verify are separate steps, so an access write is not presented as proof of success.
5. Switch to Customer, open the sample lesson, and confirm **It works—thank you**. The two confirmations are separate: technical verification and customer acknowledgement. The customer can also ask a question in the local shared conversation at any point.
6. Download measured facts. Duration starts at the first recorded case event; it is not a real-world customer wait-time claim. Message count excludes automatic updates and private notes. No revenue-saved or dispute-prevention estimates are claimed.

## Customer still needs help

After the technical check passes, switch to Customer and choose **I still need help**. The outcome chapter reopens, customer confirmation is cleared, and the customer can add detail in the conversation. Switch to Merchant to acknowledge the report and choose **Recheck access only**. That action rereads the sample payment, entitlement, and lesson without another grant. The customer must open the lesson again before confirming success. This path demonstrates that a passed technical probe does not dismiss a customer's report.

After the recheck, the merchant can send another Relay suggestion. Even when the new technical check passes, its wording says the customer's request stays open until the customer can use the lesson.

## Correct refusal

Choose **A repair correctly refused**. A completed sample payment references another order. Investigate: the same core rules used by the app block rehearsal and approval. Request the matching order reference, then switch to Customer to see the request and reply. No access grant occurs.

## Incomplete verification

Choose **Verification needs another check**. The first verification attempt cannot read the payment and lesson. The journey marks proof as needing a check, the case stays open, and retrying verification does not repeat the access grant. This demonstrates why an applied correction is not itself a recovery claim.

## Connected workspace

The Focus case now includes the same concise decision brief and outcome-facts receipt. Its figures come from saved case events and the support conversation. If support cannot be retrieved, message count is unavailable and customer confirmation remains unconfirmed. Open the actual customer tracker through the admin communication panel to demonstrate the server-backed flow. Optional PayPal sandbox, model calls, email, and Render Workflows still require their documented configuration and validation.

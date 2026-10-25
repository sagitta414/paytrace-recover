# PayTrace Recover engineering guidance

Run `npm test` before proposing a change. Keep demo claims distinct from connected PayPal, Render, and course-service evidence.

## Code Review Rules

### Payment and learner identity
For changes to payment intake, evidence checks, approval, or grants, verify that a fresh completed capture matches the saved order, learner, course, amount, and currency. A PayPal event is a trigger, not sufficient proof for an access change. If any match is missing, hold the case and make zero grants. A narrow grant after fresh matching evidence and merchant approval is the safe path.

### Approval and verification
For changes to recovery actions, confirm that an access grant requires a current merchant approval of the exact preview. Retrying a failed verification must read payment, entitlement, and protected lesson again without repeating the grant. A write alone never means verified; leave the case open until those current checks agree.

### Customer data and observability
For changes to logs, traces, errors, or support messages, check that credentials, tokens, buyer email, learner identity, raw order or capture IDs, prompts, and provider error bodies cannot leave the appropriate private boundary. Use a pseudonymous case key and fixed status labels in telemetry; keep the full evidence only in the authorized case record.

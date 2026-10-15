# Focus frontend

Entry: `/focus.html`. The public Sites deployment uses browser simulation; `npm run dev` serves the same page against the existing Node API. The landing page navigation links to Focus; the advanced demo and design galleries remain available.

## Merchant flow

Three queues: Needs your attention, Investigating, Resolved. Search matches customer, case ID, or course. Case review progressively reveals purchase evidence, source records, specialist consultation, audit events, and an editable copy-only customer reply.

Evidence review → correction preview → unchecked merchant consent → approval → separate apply-and-verify action. A failed outcome check stays in attention with a verification-only retry. Resolution requires a current proof, not just a successful access write.

## Integration boundary

`runtime.js` selects browser simulation or server mode. Server mode initializes the session through `/api/state`, reads `/api/operations`, selects cases and performs transitions through `/api/action`, and refreshes authoritative state afterward. Workflow jobs remain pending until explicitly refreshed. The frontend never grants course access directly in server mode. It reuses the existing core engine in simulation mode. Duplicate actions are disabled while a request is in flight; backend validation remains authoritative.

The browser demo stores only sample cases in sessionStorage under `paytrace-focus-v1`. Public agents are scripted and labeled. PayPal sandbox, model-backed analysis, Render workflows, production merchant authentication, and actual merchant storefront integration are not validated by this frontend release. No customer messages are sent.

## Verification

42 automated tests passed, including new Focus tests for failed verification, outdated proof, and separate approval/execution steps. Browser checks covered consent gating, successful recovery, failed verification with read-only retry, and a 390px viewport with no horizontal overflow. A local Node-backed browser run completed session initialization, case selection, investigation, preview, approval, repair, and protected-content verification. That run caught and fixed missing session initialization before reading the case portfolio.

# Focus frontend

## Case retrieval and failure handling

The Node backend now exposes session-scoped `GET /api/case?caseId=...` for the selected case. It independently reads the payment adapter (PayPal sandbox for sandbox-origin captures, sample fixtures otherwise) and course-access adapter (the local course_access table). It returns separate availability, attempt timestamps, and last-success timestamps. Failed reads retain last-known values and invalidate approvals/proof; an outage is not treated as missing access. Action boundaries re-read the adapters. The course adapter is injectable in service tests; a real merchant platform adapter remains to be implemented and validated.

Focus uses a timed request client with explicit network, timeout, session, server, rejection, and invalid-response errors. Portfolio and detail snapshots are validated before replacing the visible view. Interrupted requests require an explicit read-only refresh before further mutations. There are no automatic mutation retries. Guided mode also warns when the status is unconfirmed.

Validation: 55 automated tests passed, including both-source retrieval, HTTP session scope, network failures, timeouts, 401/503 responses, invalid JSON, partial/wrong-case payloads, unavailable source retention, and a repair that succeeds but loses its response. A local browser fault-injection run confirmed that a failed post-approval refresh preserved the case, blocked execution, and recovered through a read-only status refresh. The failure harness is under ignored `qa/` and is not published. PayPal tests use an injected adapter; no credentialed live sandbox or third-party course platform was exercised. Public Sites hosting remains a browser simulation; Node server changes must be deployed with the backend.

## AI identities and optional guidance

The workspace reuses `dist/assets/crew-portraits.webp` for four fictional AI personas. Portraits appear on clickable team cards, specialist explanations, profiles, and guidance. Profiles state each specialist's scope and boundaries and distinguish fictional personas from human support representatives. No new image generation or external portrait service was used.

`focus-guide.mjs` provides a five-step, dismissible orientation and an optional guided mode saved in this tab's sessionStorage. Contextual guidance reads the current case phase without changing case data. “Show me where” only expands and focuses the relevant evidence section. The guide never approves, repairs, or bypasses consent. Native dialogs support keyboard focus containment and Escape dismissal.

Validation: 45 automated tests pass, including three tests proving guide purity, blocked-evidence guidance, and failed-verification messaging. Browser checks covered profiles, all tour steps, enable/disable, section reveal, the approval checkbox remaining required, and mobile dialog/layout bounds.

## Workspace refinement

The refined workspace adds a state-based suggested case (verification problems first, then previews/approved actions), queue sorting, empty-search recovery, a current-proof-based recovery count, and a recent activity feed. Activity opens the originating case. Connections reports runtime configuration honestly; configured does not imply health-checked. No connection is established by viewing that page.

The review adds separate payment, entitlement, and outcome indicators. Navigation, search, sorting, explicit approval, successful repair, and mobile dashboard/review layouts were exercised in the browser. The 42-test suite remains passing. Public content remains a simulation.

Entry: `/focus.html`. The public Sites deployment uses browser simulation; `npm run dev` serves the same page against the existing Node API. The landing page navigation links to Focus; the advanced demo and design galleries remain available.

## Merchant flow

Three queues: Needs your attention, Investigating, Resolved. Search matches customer, case ID, or course. Case review progressively reveals purchase evidence, source records, specialist consultation, audit events, and an editable copy-only customer reply.

Evidence review → correction preview → unchecked merchant consent → approval → separate apply-and-verify action. A failed outcome check stays in attention with a verification-only retry. Resolution requires a current proof, not just a successful access write.

## Integration boundary

`runtime.js` selects browser simulation or server mode. Server mode initializes the session through `/api/state`, reads `/api/operations`, selects cases and performs transitions through `/api/action`, and refreshes authoritative state afterward. Workflow jobs remain pending until explicitly refreshed. The frontend never grants course access directly in server mode. It reuses the existing core engine in simulation mode. Duplicate actions are disabled while a request is in flight; backend validation remains authoritative.

The browser demo stores only sample cases in sessionStorage under `paytrace-focus-v1`. Public agents are scripted and labeled. PayPal sandbox, model-backed analysis, Render workflows, production merchant authentication, and actual merchant storefront integration are not validated by this frontend release. No customer messages are sent.

## Verification

42 automated tests passed, including new Focus tests for failed verification, outdated proof, and separate approval/execution steps. Browser checks covered consent gating, successful recovery, failed verification with read-only retry, and a 390px viewport with no horizontal overflow. A local Node-backed browser run completed session initialization, case selection, investigation, preview, approval, repair, and protected-content verification. That run caught and fixed missing session initialization before reading the case portfolio.
# New case intake

Use **+ New case** above the Focus dashboard to create a case for the fixed $128 demo course. Enter a fictional customer display name and choose either an unpaid PayPal sandbox purchase or a clearly labeled sample payment. Each case receives a unique demo learner identity. This does not import an existing external payment or connect a real LMS customer.

The backend `create-case` action validates input, persists the case in the session's portfolio, and selects it. Repeating the same creation request returns the existing case; altered details with the same request ID are rejected. Cases are limited to 100 per demo workspace. No approval, entitlement, or captured payment can be supplied by the caller.

For sandbox cases, choose **Open sandbox checkout**, unlock integrations on the checkout desk, and switch to the learner view. Do not restart the story: that would select a different purchase. Sample-payment substitution is blocked for sandbox-intake cases. After checkout, return to Focus and open the case from the queue. Approval and verification remain required.

Static mode supports sample creation only, retained in browser session storage. Render backend mode persists cases in SQLite. Native dialog controls provide labels, keyboard focus containment, cancel, validation, and visible request errors. Uncertain creation responses can be retried with the same request ID while the form remains available.

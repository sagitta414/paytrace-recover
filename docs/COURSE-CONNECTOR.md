# Course bridge protocol: paytrace-course-v1

This is an executable HTTP client contract, not a claim that an arbitrary LMS already supports it. The configured platform or a merchant-owned adapter must implement these endpoints over HTTPS. PayTrace never stores the platform secret in browser assets.

1. GET `<COURSE_API_URL>/v1/capabilities` with server-side Bearer authentication returns `{ "protocol":"paytrace-course-v1", "idempotentWrites":true, "purchaseScopedAccess":true }`.
2. GET `/v1/entitlements/{courseId}/{learnerId}?purchase={purchaseId}` with the same Bearer token and `X-PayTrace-Workspace` returns `{workspaceId,caseId,userId,courseId,captureId,active}`. Course/learner/path values are URL encoded. Known inactive purchases return an explicit scoped record; an unknown/mismatched record must not be treated as proof of inactive access.
3. PUT the same path with `Idempotency-Key` and JSON `{workspaceId,caseId,purchaseId,userId,courseId,captureId,expectedCaptureId,active}`. Persist the key and exact payload atomically with the entitlement change; replaying a key must return its original result, and changing its payload must fail. Return the confirmed scoped entitlement. Grant and suspension use distinct stable operation keys.
4. GET the same path plus `/content` returns `{workspaceId,caseId,userId,courseId,captureId,accessible,contentId,body}`. This must retrieve actual purchased content through a learner/purchase-scoped authorization check. An administrative health page or a fabricated success response is insufficient.

The bridge must authenticate requests, enforce ownership of each workspace/course/learner/purchase, and restrict suspension to the referenced purchase so that another purchase's enrollment is never removed. Do not merely echo caller-supplied identity fields. Only advertise the capabilities after implementing these guarantees. A shared administrative token does not itself establish tenant or purchase ownership.

PayTrace checks the response workspace, case, learner, course, capture and active state. It refuses redirects and uses bounded timeouts. Grants require a current exact preview and human approval. Before an external write, a durable local intent stores its identity digest, approval and operation key. On an ambiguous result, retries first read the platform and reconcile an already-applied matching grant; they do not invent a new write key.

The included tests exercise the client against a deterministic bridge fixture, including a lost write response and a wrong-workspace response. Actual compatibility requires your platform endpoint and credentials. This build keeps PayPal sandbox as the payment provider; do not treat it as a production card-processing integration.

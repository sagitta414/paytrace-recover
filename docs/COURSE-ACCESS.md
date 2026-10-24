# Separate course-access service

PayTrace can read and repair a sandbox purchase against a separate course service. This is optional; without `COURSE_ACCESS_URL` and `COURSE_ACCESS_API_KEY`, the built-in demo course remains the access source. Only cases created in **sandbox** mode use the separate service. The service contract is a reference integration, not a connector to an existing commercial LMS.

For a local two-process demo, start `node examples/course-service.mjs` with `COURSE_SERVICE_KEY` set to a private value of at least 16 characters. It listens on `127.0.0.1:4360` and saves its own SQLite file at `data/reference-course.sqlite`; `COURSE_SERVICE_PORT` and `COURSE_SERVICE_DATABASE` can override those defaults. In PayTrace's `.env`, set `COURSE_ACCESS_URL=http://127.0.0.1:4360` and set `COURSE_ACCESS_API_KEY` to the same private value. Start PayTrace with `npm start`. PayPal sandbox credentials and the PayTrace operator key are also required for an actual sandbox checkout. Do not commit any key or `.env` file.

The adapter makes authenticated JSON POSTs to three endpoints. Each request carries `caseId`, `userId`, `courseId`, and `captureId` (null before capture). The course service must own its access records, enforce the same purchase identity on retries, and return JSON:

| Endpoint | Purpose | Required response |
| --- | --- | --- |
| `/v1/access/check` | Read the current entitlement | `userId`, `courseId`, `active`, `captureId` |
| `/v1/access/grants` | Apply one approved access grant | Same fields with `active: true`; honor `Idempotency-Key: paytrace:<caseId>:<captureId>` |
| `/v1/access/lesson-probe` | Retrieve protected lesson content after repair | `accessible: true`, matching `userId`, `courseId`, `captureId`, `contentId: light-lesson-01`, and nonempty `body` |

PayTrace checks fresh PayPal and course records before an approved grant. It calls the external grant only after merchant approval, then confirms the grant and separately probes protected content. A failed grant leaves the case open with no recorded repair. A failed lesson probe leaves it unverified; the merchant can retry verification without granting again. If a network timeout occurs after the remote service applied the grant, the next read may show access already present. Review the current records and verify; the deterministic grant key prevents a duplicate remote write.

The reference service is intentionally one demo tenant with a static API key. It trusts PayTrace to confirm the PayPal capture and operator approval before calling the grant endpoint. For a deployed merchant integration, implement tenant authentication, key rotation, network restrictions, purchase validation at the course service, and a real learner-authenticated content check. The current probe proves that the course service can return protected content for the purchase identity; it does not prove delivery to a customer's device.

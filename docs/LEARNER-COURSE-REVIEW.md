# Learner course delivery review · 2026-11-10

Scope: `/course.html`, the private customer-page link, course case labeling, and the 77-second submission review cut. Shared frontend standards version 1.1. Light theme; Codex in-app browser.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Private entry | PASS | An unauthenticated course visit showed only the private-link guidance. The live private case API returned 401 without a session. |
| Locked state | PASS | A private fictional case without verified access rendered the same first lesson as locked; no lesson body was present. |
| Ready and open state | PASS | A verified private case rendered “Access ready”; clicking Open fetched protected lesson text through `/api/customer/lesson`. |
| Safety boundary | PASS | The course-service key is absent from browser code. The existing lesson endpoint checks current proof and exact course identity; the route and customer endpoints retain CSP, frame, and session protections. |
| Visual and reflow | PASS for tested sizes | Reviewed rendered 1280px desktop and 320px mobile views. At 320px, document scroll width was 305px, body text 16px, and the primary action 48px high. |
| Automated behavior | PASS | `npm test` (354 tests); focused customer/security tests (14 tests); `node --check`; `git diff --check`. |
| Video export | PASS for file integrity and sampled frames | 77.25-second H.264/AAC MP4. Sampled visual frames were reviewed. Fictional, connected, and visual-preview sections have distinct labels. |
| Live static release | PASS for route and health checks | `/course.html`, `/course.css`, `/course.mjs`, and the customer link returned 200; `/health` remained 200. No restart was requested. The server-side mode projection and CSP header change await a full Node release; the page has its own CSP meta policy and a conservative label fallback. |
| Audio and captions | NOT TESTED | The source audio is retained with short fades, but narration quality and exact words could not be listened to here. Accurate captions were not produced. Review both before publication. |
| Live connected buyer visit to new course page | NOT TESTED | The browser check used local in-memory fictional fixtures; the recorded connected case predates the new course page. |
| Full accessibility conformance | NOT TESTED | No automated axe runner or screen-reader smoke test was available for this route. 200% text enlargement, 400% zoom, forced colors, and text-spacing overrides remain to be manually checked. No WCAG conformance claim is made. |

The video is a review cut. Its course cards are labeled visual previews; the connected footage is a separate recorded case. Replace those previews with a fresh one-case course journey and add checked captions for the final submission.

## Visual refinement · 2026-11-10

The course front door now uses a custom SVG still life, an editorial cover, a compact three-stage access path, and one featured lesson. The unlocked state keeps the same position and changes its status and action. No protected content is included in the page source; the existing private lesson request still controls opening.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Brand and hierarchy | PASS | Rendered local desktop preview: workshop identity, course image, access path, and lesson action read in order. |
| Mobile composition | PASS for tested sizes | Rendered 390px and 320px views; the image and access path recompose. At 320px the document scroll width was 305px, body text 16px, and primary action 48px. |
| Locked state | PASS | Local fixture showed a locked lesson and purchase-progress link, without protected body. |
| Ready/open state | PASS | Local fixture showed the ready lesson; clicking Open lesson rendered the protected response. Fixture data is only for visual testing, not connected verification. |
| Automated checks | PASS | `npm test` (354 tests), `node --check dist/course.mjs`, `git diff --check`, and `npm run check:review-links` (109 targets). |
| Accessibility scan, zoom, forced colors, screen reader | NOT TESTED | No automated scanner or screen reader was available in this visual review. No WCAG conformance claim. |

## Learner-site realism pass · 2026-11-10

The course front door now uses real, credited photography and a calmer editorial layout. The invented multi-chapter outline and drawn SVG artwork are gone; the contents show only the implemented first lesson. The purchase/access/lesson path remains visible, while the protected lesson still loads only after a private ready-state check and a click.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Visual identity and hierarchy | PASS | Rendered desktop view: course wordmark, photographic cover, access status, and lesson occupy clear levels without decorative cards. |
| Responsive composition | PASS for tested sizes | Rendered 390px and 320px views. At 320px, document scroll width was 305px, body text 16px, and the primary action 60px high due to wrapping. |
| Locked view | PASS | Local fixture showed the progress action, no protected lesson body, and a purchase-status explanation. |
| Ready and open view | PASS | Local fixture showed Open lesson; clicking displayed the protected response. The fixture is not connected proof. |
| Photography | PASS | Two self-hosted WebP images, 384 KB combined, selected for recognizable light and shadow; source links and license are recorded in the visual brief and credits appear in the footer. |
| Automated checks | PASS | `npm test` (354 tests), `node --check dist/course.mjs`, `git diff --check`, and `npm run check:review-links` (109 targets). |
| Full accessibility and connected buyer visit | NOT TESTED | Automated scan, screen-reader flow, zoom/forced-colors matrix, and a live connected private-session visit were not completed. No WCAG or connected-success claim. |

## Classroom experience pass · 2026-11-10

The lesson is now the first focal point instead of a large promotional cover. A single course guide shows the actual lesson and access state; on narrow screens it moves below the lesson. Opening the protected lesson turns its returned exercise into a numbered reading flow. The browser receipt remains an internal evidence event rather than learner-facing completion copy.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Desktop composition | PASS | Rendered local desktop view in Codex in-app browser: lesson cover, action, and access guide form a clear reading hierarchy. |
| Mobile composition | PASS for tested sizes | Rendered locked state at 390px and 320px. The lesson comes before the guide; text and primary action remain legible. |
| Locked state | PASS | Local fixture exposed no protected exercise body and offered a purchase-progress action. |
| Ready/open state | PASS | Local fixture opened the protected lesson response and displayed three exercise steps; this was a UI fixture, not connected course-service proof. |
| Source safety | PASS | Lesson title and body are HTML-escaped; protected exercise sentences are absent from the static HTML and module. |
| Automated checks | PASS | `npm test` (354), `node --check dist/course.mjs`, `git diff --check`, and `npm run check:review-links` (109 local targets). |
| Full accessibility and connected buyer visit | NOT TESTED | No automated accessibility scanner, screen-reader pass, zoom/forced-colors matrix, or live private-session visit in this pass. No WCAG or connected-success claim. |

The live unauthenticated entry was then reviewed and found too sparse. It now has the same workshop photography, editorial hierarchy, and clear purchase-entry action. Rendered local desktop and 390px views were inspected; the actual live route will be checked after publishing. The private exercise remains absent from that state.

## Premier studio pass · 2026-11-10

The public course entry now behaves like a focused photography studio cover: a dark palette, expressive serif headline, real window-light image, and a clear purchase-entry action. One-time image/copy reveals and a brief light sweep draw attention to the subject; hover responds without moving the layout. The private classroom keeps the same lesson and entitlement boundaries, with only a restrained cover reveal added.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Public desktop and mobile composition | PASS for tested sizes | Rendered local in-app browser at desktop, 390px, and 320px. Headline, subject image, action, footer, and mobile reading order were inspected. |
| Private ready/open flow | PASS with fixture | Local ready-state fixture opened the protected lesson response; its content was not embedded in the static page. Fixture data is not connected proof. |
| Motion and reduced motion | PASS in source; manual preference check NOT TESTED | Animations are limited to one-time reveals and visitor hover; the CSS reduced-motion rule removes them. A system preference toggle was not exercised in-browser. |
| Text contrast | PASS for sampled pairs | Calculated 14.89:1 for ivory on forest, 9.75:1 for gold on forest, and 10.48:1 for dark action text on gold. Image-adjacent text sits on the solid dark surface. |
| Accessibility audit | NOT TESTED | No automated scanner, screen-reader pass, zoom/forced-colors matrix, or live private-session visit in this pass. No WCAG conformance claim. |

## Editorial realism revision · 2026-11-10

The public course page was revised after feedback that the dark hero and animated light effect felt artificial. It now presents the actual one-lesson workshop as a course: a quiet masthead, a licensed photograph of a photographer at work, a short overview, a single lesson preview, and a clear private-purchase route. The private classroom copy follows the same editorial language. No payment, entitlement, or protected-lesson request logic changed.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Identity, hierarchy, composition, typography, imagery, craft | PASS for tested public view | Inspected rendered public desktop and 390px mobile views in the Codex in-app browser. The title, course purpose, purchase action, real photograph, and single lesson now form a clear reading order. Initial oversized image was fixed and recaptured. |
| Mobile | PASS at 390px | The public page reflows to a single column with readable navigation, title, action, and photo. |
| Public metadata and image loading | PASS locally | Title and description match the revised course page; self-hosted photos loaded in the local browser. |
| Automated behavior | PASS | `npm test` (354 passing), `node --check dist/course.mjs`, and `git diff --check`. |
| Private ready/open and locked visual states | NOT TESTED in this revision | Content copy changed but no fixture browser pass was run for private states. Earlier fixture results are recorded above. |
| Full accessibility and connected buyer visit | NOT TESTED | No axe scan, screen-reader flow, zoom/forced-colors matrix, or live private-session visit in this revision. No WCAG or connected-success claim. |

## Course overview and access-help revision · 2026-11-10

Scope: public `/course.html`, private ready/locked course views, and the navigation to the existing `/customer.html` purchase-support flow. The public overview names only the implemented lesson and does not expose its protected body.

| Check | Result | Evidence / limit |
| --- | --- | --- |
| Public hierarchy and imagery | PASS for tested desktop/mobile | Rendered local desktop, 390px, and 320px views. The course purpose, lesson route, access-help action, image, facts, and outline remain readable in order. |
| Locked and ready states | PASS with local fixtures | Rendered both private case states locally. The access-help action appears beside the case access status; the locked state does not include protected lesson text. The fixture is not connected service proof. |
| Access-help destination | PASS in source | Both public and private actions link to the existing customer page. That page offers purchase lookup without a session and conversation/help with a private case session. |
| Automated behavior | PASS | `npm test` (354 passing), `node --check dist/course.mjs`, `git diff --check`, and local review-link check. |
| Full accessibility and connected buyer visit | NOT TESTED | No axe scan, screen-reader flow, zoom/forced-colors matrix, or live private-session visit in this revision. No WCAG conformance claim. |

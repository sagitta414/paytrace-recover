# Demo video review against the PayPal AI Hackathon requirements

Reviewed 2026-11-10. Submission deadline: **Thursday, November 12, 2026, 12:00 p.m. Pacific**.

- **Video:** `~/Downloads/PayTrace-Polished-Demo(1).mp4`, 2:19 (138.97 s), 1920x1080, 30 fps, H.264 at 547 kbps, mono AAC narration, no music, no captions.
- **Sources:** [hackathon overview](https://paypalaihackathon.devpost.com/), [official rules](https://paypalaihackathon.devpost.com/rules), [video tips and judging update](https://paypalaihackathon.devpost.com/updates/47306-lights-camera-paypal-video-tips-and-how-judging-works), [submission checklist update](https://paypalaihackathon.devpost.com/updates/47307-submission-checklist-it-s-go-time).
- **Method:** frames sampled every 3 s plus full-size stills at each scene change; narration transcribed locally with whisper.cpp (`base.en`). Timestamps are from the file. Quoted narration is machine-transcribed and may differ by a word.

## Verdict

The video clears every hard rule that can be checked from the file. Its weakness is scoring, not eligibility: 60% of the runtime is a scripted fictional sample, PayPal does not appear until 1:23, and neither PayPal nor the AI is ever shown *running*. The organizers' own tip is to "show PayPal and AI working end to end," and they note judges are not required to run the project, so the video carries most of the score. There are 41 seconds of unused runtime to fix this.

## Findings

Severity: **P0** fix before upload, **P1** fix if a re-record or re-edit happens, **P2** polish.

| # | Sev | Requirement or criterion | What the video does | Gap | Change to make |
| --- | --- | --- | --- | --- | --- |
| 1 | P0 | Presentation: "clearly demonstrate the project working end-to-end." Video tip: "show PayPal and AI working end to end." | 0:00–1:23 is the labeled fictional Maya walkthrough. 1:23–2:08 reviews a connected run that already finished ("We're reviewing a completed run rather than performing another grant"). | No connected action happens on camera. A judge who does not open the demo sees a scripted sample followed by a results page. | Cut the Maya section to about 25 s and use the freed time for live connected footage: PayPal sandbox checkout approval, the case appearing, a model-backed investigation returning, approve, grant, lesson opening. Trimming wait time is allowed; splicing different purchases is not (`docs/VIDEO-RECORDING.md`). |
| 2 | P0 | Stage One: "meaningful use of PayPal and AI." Technological Implementation: how thoroughly the project uses the PayPal Developer Platform. | PayPal first appears at 1:27 as a status chip ("PayPal sandbox capture recorded"). No checkout, order, capture, or webhook is shown or named. | PayPal looks like a label, not an integration. The rules require PayPal to be "central to the project." | Show the PayPal sandbox approval window and the returned capture in the first 30 s. Say which PayPal capabilities are used (Orders create and capture, the fresh capture reread, webhook as a trigger only). |
| 3 | P0 | Stage One and Technological Implementation: meaningful AI. Submission: "identify which tools were used." | The only AI output on screen (0:21–0:33) is footed "These conclusions are sample data, not a live model response," and the narration says "in this scripted sample." The connected AI evidence is one card at 1:46 reading `gpt-4o-mini` in small type. | The video never shows a model-backed review, and never names the model or provider aloud. | In the connected case, open "Evidence & agents" and hold on one model-backed specialist finding with its cited source IDs for 6–8 s. Narrate: four Azure OpenAI specialists, what each checks, and that the model explains while deterministic checks and the merchant decide. |
| 4 | P1 | Presentation: "what problem is solved, who it's for, and why it matters." Video tip: "Open with the problem and who it's for." | The opening line states the buyer's problem well ("You've paid for a course, your receipt looks fine, but the lesson won't open"). | The customer for the product, the merchant selling digital goods, is never named. No "why it matters" beyond the anecdote. | Add one sentence by 0:10: who it is for (course and digital-goods sellers taking PayPal) and the cost of the failure (support tickets, refunds, disputes). Use a figure only if `docs/SELLER_RESEARCH.md` supports it. |
| 5 | P1 | Presentation: easy to follow. | 0:00–0:09 holds on "A purchase is about to begin" while the narration describes a lesson that will not open. | The first image contradicts the first sentence. `docs/DEMO_SCRIPT.md` planned to open on the locked lesson. | Open on the locked lesson or the "payment is complete, access is missing" screen (currently 0:11). |
| 6 | P1 | Rules: no third-party trademarks without permission. Repo policy (`AGENTS.md`, `docs/DEMO_SCRIPT.md`): raw capture IDs stay private; redact public stills. | 1:42–1:51 shows a raw PayPal sandbox capture ID, a Render run ID, and the plan ID in the "Inspect all six source checks" panel. The PayPal mark appears in the payment strip at 1:27–1:33. | The IDs are sandbox values, so the exposure is low, but it breaks the project's own recording rule. The PayPal mark is the sponsor's and is the normal case for this event; it is the only third-party logo seen. | Record that panel from the redacted report, or blur the three ID lines. Keep PayPal references to what the product UI already renders; do not add partner logos to title or end cards. |
| 7 | P1 | Design: "a complete, coherent product experience." | 1:27–1:52 (merchant workspace) is pillarboxed with black bars and a partly clipped sidebar; the rest of the video is full frame. | Reads as a capture error in the one segment that carries the real evidence. | Re-capture the workspace at the same 1920x1080 viewport as the rest. |
| 8 | P1 | Design and Technological Implementation. | At 1:46 the "Render recovery" card reads "Time not recorded" while the other four show timestamps. At 1:28 the case shows "Latest email notification: Email setup needed." | Two visible "unfinished" signals in the proof segment. | Fix the missing Render timestamp in the report or frame it out; scroll past the email-setup line or configure the test inbox before recording. |
| 9 | P1 | Sponsor prize: Best Use of Render (requires use of Render tools and selecting the sponsor on the form). | Narration lists the six checks as "PayPal, course access, AI review, merchant approval, recovery, and the protected lesson." | Render is on screen but never said. | Say "Render Workflow recovery" and give it one sentence on why it is separate (investigation and correction run as distinct durable stages). Only narrate it for the run whose saved report proves it. |
| 10 | P1 | Presentation: pitch closes on why it matters. | The last spoken line is "Production validation remains separate." | The video ends on a caveat instead of the value. | Move the caveat to on-screen text (it is on the new end card) and end the voiceover on the product line: "Understand the missing access, approve a precise correction, and keep evidence of the outcome." |
| 11 | P1 | Presentation. Old end card (2:08–2:19). | Flat navy slide with a text-only wordmark, the hosted URL, and no repository link. `docs/DEMO_SCRIPT.md` says to end with the product name and public repo URL. | Dated look; missing the repo URL. | Replace with `closing-screen.mp4` in this folder (see below). |
| 12 | P2 | Presentation: easy to follow. | Narration measures −24.6 LUFS integrated. No captions. Speech recognition misheard the product name all three times it is spoken (0:06, 0:16, 2:09). | Quiet next to typical YouTube content at about −14 LUFS. The name may be slurred by the voice; this needs a human listen to confirm. | Normalize to about −16 LUFS. Upload an English caption file (`.srt`) so the name and terms are exact. If the name sounds wrong, regenerate those three lines. |
| 13 | P2 | Presentation. | UI is captured at 100% zoom; evidence text and the six-check details are small at 1080p. Export bitrate is 547 kbps. | Hard to read in an embedded or half-size player. | Record at 125% browser zoom, or add slow push-ins on the evidence cards. Export at 8 Mbps or higher. |
| 14 | P2 | Presentation: pacing. | Each fictional step holds a near-static screen for 9–12 s (for example 0:36–0:45, 0:48–0:54, 0:57–1:06). | Slow in the least valuable section. | Shorten per item 1, and add a cursor highlight or zoom to the element being described. |
| 15 | P2 | Rules: project "must function as depicted in the video and/or expressed in the text description." | The video claims a completed connected run with 6/6 checks on 11/8. `devpost-submission.md` still says the connected recovery "has not been recorded" and "remains untested." | The text contradicts the video. Not a video defect, but it will be read next to it. | Update `devpost-submission.md` and `docs/DEVPOST-SUBMISSION.md` to cite the saved 11/8 run report before submitting. |
| 16 | P0 | Rules: the project "must function as depicted in the video." Judges may open the hosted demo. | The video and the new end card show a connected run with 6/6 checks. On 2026-11-10 a fresh browser session of the hosted workspace (`focus.html`) showed 0 cases and "Full end-to-end proof pending." | A judge who opens the demo after watching the video sees no connected proof. The cause was not determined (the case may be scoped to the tester's session, or the data may have expired). The repo also holds no saved record of the 11/8 run: the form in `docs/CONNECTED-ACCEPTANCE-TEST.md` is blank and no redacted report or `acceptance:check` result is committed. | Decide which is true and make the demo match: either make the completed sandbox case visible to visitors as read-only evidence, or say in the video and in `docs/JUDGE-TESTING.md` that judges create their own case with a sandbox checkout. Save the redacted 11/8 report and the filled acceptance record before the deadline. |

## Requirement checklist

| Requirement (source) | Status | Evidence |
| --- | --- | --- |
| Under 3 minutes (rules §4) | Pass | 2:19. 41 s of headroom. |
| Shows the project functioning on its target device (rules §4) | Pass, weak | Real browser footage of the hosted app throughout. Most of it is a scripted sample; see findings 1–3. |
| Uploaded to YouTube and publicly visible, link on the form (rules §4) | Not done | `devpost-submission.md` Demo Video section is still a TODO. Upload early; processing can take hours. Verify the link signed out. |
| No third-party trademarks or copyrighted music without permission (rules §4) | Pass with note | No music. Only the PayPal mark inside the product UI; see finding 6. |
| English (rules §4) | Pass | English narration and UI. |
| Meaningfully uses PayPal and AI (overview; Stage One) | At risk in the video | Both are present in the product and in the saved run. The video under-shows them; see findings 2–3. |
| Working build judges can run (overview) | Pass, with a mismatch | Hosted demo URL plus repo instructions. A fresh session shows no connected case; see finding 16. Keep it live through December 21. |
| Public repo with visible open-source license (overview) | Pass, outside the video | MIT `LICENSE` at the repo root. The GitHub About-section detection was not rechecked in this review. |
| Sponsor tools selected on the form for sponsor prizes (checklist update) | Not verified | Form not reviewed. Select Render if finding 9 is addressed. |
| Do not edit repo, video, or linked materials after the deadline (checklist update) | Reminder | The video must be final before noon PT on November 12. |

## How the current cut maps to the five judging criteria

Each criterion is scored 1–5 and weighted equally. Judges see more than the video; the notes below cover only what the video contributes.

| Criterion | What the video shows well | What holds it back |
| --- | --- | --- |
| Technological Implementation | Six-check connected report with per-source status (1:39–1:51); separation of payment, entitlement, and lesson proof. | No PayPal API or model call on camera; AI shown is labeled scripted (findings 2, 3). |
| Design | Consistent, polished UI; clear eight-step journey; customer-side Recovery Passport. | Pillarboxed workspace segment, "Time not recorded," "Email setup needed" (findings 7, 8). |
| Potential Impact | The problem is concrete and stated in the first five seconds. | No named audience or cost of the problem (finding 4). |
| Innovation/Idea | Approval bound to an exact preview; "a write is not proof"; technical proof kept apart from customer confirmation. This is the differentiator and it comes through. | It is explained on the fictional case, not the connected one. |
| Presentation | Clear voice, logical order, honest labeling of sample versus connected evidence. | Not end to end on a connected case (finding 1); ends on a caveat (finding 10); quiet audio, no captions (finding 12). |

## Recommended re-cut (target 2:40–2:50)

| Time | Screen | Narration focus |
| --- | --- | --- |
| 0:00–0:12 | Locked lesson next to a completed payment. | The problem, who has it, why it costs merchants. |
| 0:12–0:35 | Fictional sample, compressed: mismatch, exact preview, approval bound to that preview. Keep the "sample" labels visible. | The rule the product enforces: evidence, one narrow change, a recorded decision. |
| 0:35–1:00 | Connected case: PayPal sandbox buyer approval, capture returned, case created with the mismatch. | "This is a real PayPal sandbox order and capture." Name the PayPal capabilities. |
| 1:00–1:30 | Model-backed investigation: one specialist finding with cited sources, and one objection. | Four Azure OpenAI specialists; the model explains, the merchant decides. |
| 1:30–2:00 | Exact preview, merchant approval, Render recovery run, one grant, fresh rereads, protected lesson opens. | A write is not proof; payment, entitlement, and lesson are read again. |
| 2:00–2:25 | Six-check run report (redacted IDs), then the customer's Recovery Passport and confirmation. | Technical proof and customer confirmation stay separate. |
| 2:25–2:36 | New closing screen. | Product line only. No spoken caveat. |

If there is no time to re-record, the minimum edit is: swap the end card (finding 11), drop the final spoken sentence (10), blur the three IDs (6), normalize audio and add captions (12), and trim 15–20 s of static holds from the Maya section (14). That improves polish but leaves findings 1–3 open.

## New closing screen

Files in this folder:

| File | Purpose |
| --- | --- |
| `closing-screen.mp4` | 10.7 s, 1920x1080, 30 fps, silent. Same length as the current end card (2:08.27 to the end), so it drops in under the existing narration. |
| `closing-screen.png` | Final frame, for a YouTube thumbnail or a static hold. |
| `closing-screen.html` | Source. Open it in a browser to watch the animation; add `?t=4.5` to freeze any moment. Edit the text here. |
| `render-closing-screen.sh` | Re-exports the MP4 and PNG after an edit. Takes an optional length in seconds. Needs Google Chrome and ffmpeg. |
| `PayTrace-Demo-new-ending-preview.mp4` | The current video with the new ending spliced in, for review only. It is not the recommended final cut and is kept out of the repository; ask the reviewer for the file. |

What changed from the old card: the product logo, a gradient mesh background with a "trace" line that resolves at the proof card, the 6/6 connected-check summary from the 11/8 saved run, the live demo and repository URLs, and the sandbox caveat as on-screen text. Animation settles by 5 s and holds.

Before using it, confirm two things the card asserts: the saved run date (Nov 8, 2026, read from the report timestamps in the video) and that all six checks in that report are still marked connected.

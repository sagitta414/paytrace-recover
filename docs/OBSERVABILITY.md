# Recovery tracing and release checks

PayTrace emits manual OpenTelemetry spans for case reads, investigations, approval, PayPal actions, Render workflow stages, actual automatic triage, repair, and verification. Idle 30-second monitor scans do not emit spans. Span names are fixed (`recovery.repair`, `recovery.verify`, and so on). The only case correlation value is a 16-character SHA-256-derived key; spans contain a fixed phase label and generic failure flag. They do **not** contain buyer details, raw payment IDs, prompts, provider error messages, or secrets. This key is for operational correlation, not a new customer identifier or a security boundary.

The Azure deployment exports to the dedicated `paytrace-recover-insights` Application Insights resource and `paytrace-recover-logs` Log Analytics workspace in `provenance-pilot-rg`. The workspace has a 0.1 GB/day ingestion cap; it can stop collecting telemetry after reaching that cap. A live `recovery.case-read` span was confirmed in `AppDependencies` on 2026-10-25. For another environment, set `APPLICATIONINSIGHTS_CONNECTION_STRING` server-side; the app starts normally without it. The server preloads Microsoft's OpenTelemetry distro before application code. Automatic HTTP, SDK, database, logging, and AI instrumentations are disabled because they might capture request URLs or content. No customer browser instrumentation is installed.

Useful starting queries in Application Insights Logs (table/property names can vary by workspace mode):

```kusto
AppDependencies
| where TimeGenerated > ago(24h) and Name startswith "recovery."
| extend caseKey = tostring(Properties["paytrace.case_key"]), phase = tostring(Properties["paytrace.phase"])
| project TimeGenerated, Name, caseKey, phase, Success, DurationMs
| order by TimeGenerated desc
```

```kusto
AppDependencies
| where TimeGenerated > ago(15m) and Name in ("recovery.repair", "recovery.verify", "recovery.workflow-verify")
| where Success == false or tostring(Properties["paytrace.phase"]) == "unverified"
| summarize failures=count() by Name
```

The enabled Azure Monitor rule `paytrace-recovery-verification-alert` evaluates failed repair/verification spans and unresolved verification every five minutes over a 15-minute window. It is visible in Azure Alerts. No action group is attached, so it sends no email or SMS; add a team destination separately when one is chosen. A failed span is an operational signal; the authoritative case status still comes from the current payment, entitlement, and protected-content reads.

The repository's GitHub Actions workflow runs `npm ci` and `npm test` on every pull request and push to `main`. The 24 new regression checks cover mismatched payment and access evidence, stale approval, failed lesson verification, and a failed access read after approval. Live model evaluation remains an optional manual check with `npm run ai:eval` and server-side credentials; `AI_EVAL_EXTENDED=1 npm run ai:eval` adds eight more cases for 13 total specialist consultations. CI does not need AI or PayPal secrets.

Codex Code Review can use the three scoped rules in root `AGENTS.md`. Enable Codex Code Review for this repository in the connected GitHub/Codex account, then request a review on a pull request. The rules complement, rather than replace, tests and merchant approval. Until it is enabled and a PR receives a review, no automated Codex review should be claimed.

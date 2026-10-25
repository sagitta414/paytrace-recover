# Recovery tracing and release checks

PayTrace emits manual OpenTelemetry spans for case reads, investigations, approval, PayPal actions, Render workflow stages, monitoring, repair, and verification. Span names are fixed (`recovery.repair`, `recovery.verify`, and so on). The only case correlation value is a 16-character SHA-256-derived key; spans contain a fixed phase label and generic failure flag. They do **not** contain buyer details, raw payment IDs, prompts, provider error messages, or secrets. This key is for operational correlation, not a new customer identifier or a security boundary.

The app starts normally without `APPLICATIONINSIGHTS_CONNECTION_STRING`. To export spans to Azure, create an Application Insights resource, copy its connection string into the Azure App Service setting named `APPLICATIONINSIGHTS_CONNECTION_STRING`, and restart the app. The server preloads Microsoft's OpenTelemetry distro before application code. Automatic HTTP, SDK, database, logging, and AI instrumentations are disabled because they might capture request URLs or content. No customer browser instrumentation is installed. Check Azure's `AppDependencies` table for `recovery.*` spans after a case action; do not describe telemetry as active until a real span arrives.

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

Use the second query for an Azure Monitor scheduled-query alert when Application Insights is connected. Send alerts to the team's chosen action group. A failed span is an operational signal; the authoritative case status still comes from the current payment, entitlement, and protected-content reads. Set sampling and a daily ingestion cap appropriate for the demo budget before enabling telemetry broadly.

The repository's GitHub Actions workflow runs `npm ci` and `npm test` on every pull request and push to `main`. The 24 new regression checks cover mismatched payment and access evidence, stale approval, failed lesson verification, and a failed access read after approval. Live model evaluation remains an optional manual check with `npm run ai:eval` and server-side credentials; `AI_EVAL_EXTENDED=1 npm run ai:eval` adds eight more cases for 13 total specialist consultations. CI does not need AI or PayPal secrets.

Codex Code Review can use the three scoped rules in root `AGENTS.md`. Enable Codex Code Review for this repository in the connected GitHub/Codex account, then request a review on a pull request. The rules complement, rather than replace, tests and merchant approval. Until it is enabled and a PR receives a review, no automated Codex review should be claimed.

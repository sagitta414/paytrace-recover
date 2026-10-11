# PayTrace Recover public showcase

Static, responsive showcase with a custom landing page and two interactive, exported concept demos.

All customer records, specialist consultations, corrections, and verification reads are simulated. This site does not call PayPal, Render, a merchant backend, or an AI model. It is independent of PayPal and its sponsors.

## Files

- `dist/index.html`, `site.css`, `site.js`: landing page and local interactions.
- `source/`: editable visualization sources for the recovery and agent demos.
- `export-demos.cjs`: regenerates standalone demo pages using the visualization renderer and adds site navigation.
- `serve.cjs`: local static server on port 4357.
- `.openai/hosting.json`: Sites identity and static publishing directory.

Run `node serve.cjs` for local preview. Run `node export-demos.cjs` after editing the demo sources; the helper references the installed local rendering runtime.

The deployment uses Sites. Render Workflows is the proposed orchestration partner for a future working backend; it is not the host or executing engine for this public demonstration.

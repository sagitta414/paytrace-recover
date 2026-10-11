# PayTrace Recover public showcase

Static, responsive showcase with a custom landing page and two interactive, exported concept demos.

All customer records, specialist consultations, corrections, and verification reads are simulated. This site does not call PayPal, Render, a merchant backend, or an AI model. It is independent of PayPal and its sponsors.

## Files

- `dist/index.html`, `site.css`, `crew.css`, `site.js`: landing page and local interactions.
- `source/`: editable visualization sources for the recovery and agent demos.
- `export-demos.cjs`: regenerates standalone demo pages using the visualization renderer and adds site navigation.
- `serve.cjs`: local static server on port 4357.
- `.openai/hosting.json`: Sites identity and static publishing directory.

Run `node serve.cjs` for local preview. Run `node export-demos.cjs` after editing the demo sources; the helper references the installed local rendering runtime.

The deployment uses Sites. Render Workflows is the proposed orchestration partner for a future working backend; it is not the host or executing engine for this public demonstration.

## Character refresh

Four fictional AI personas now have distinct portraits, friendly introductions, and first-person explanations across the homepage and both demos. Ledger is the calm fact-checker, Relay the curious investigator, Patch the practical fixer, and Prism the thoughtful reviewer. Their original analytical responsibilities, uncertainty boundaries, and merchant approval remain intact.

The portrait atlas was created with the built-in image generation tool. Original: `source/crew-portraits-original.png`. Web asset: `dist/assets/crew-portraits.webp` (189 KB, same composition encoded as WebP). Demo exports embed the WebP so it loads within their restrictive sandbox. See `source/portrait-prompt.txt` for the generation prompt.

Verified locally: desktop visual review; phone widths of 390 and 320 pixels without horizontal page overflow; homepage personality selection; agent-room profile selection; portrait loading within both demos; recovery approval reaching matching records with one correction. All behavior remains simulated.

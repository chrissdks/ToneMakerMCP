# Development

Use Node 22.12+ (tested on the installed Node 24) and npm. Run npm ci, then copy .env.example to .env only if no credential file already exists. npm run build builds backend and bundled UI. npm run typecheck checks both separately. npm test runs deterministic backend, HTTP and React/bridge tests. npm run test:browser uses an installed Chrome with a local official AppBridge harness; it does not access an external AI product. npm audit checks all dependencies.

npm run dev starts stdio from TypeScript. npm run dev:http starts guarded local HTTP. npm run dev:ui is a Vite layout preview and does not provide an MCP host. Keep credential values out of frontend code, fixtures, screenshots and logs. The API key is loaded only on the server.

## Verification scope

Baseline: 24 tests passed before changes. Tests cover preset removal, core tool registration, UI resource discovery, offline catalog, routing rules, classification, URL parsing, API errors and malformed metadata, concurrent local profile updates, corruption preservation, HTTP Host/Origin rejection, actual Streamable HTTP tool calls, React interactions and mocked host integration. Live search and detail were checked against TONE3000; its creator IDs can be strings and the schemas reflect that observed boundary.

The local browser harness passed the official AppBridge handshake, initial result delivery, real missing-credential tool errors, real offline recommendation, and desktop/narrow layout checks in installed Chrome. Sandboxed form actions do not require allow-forms. External host UI rendering is unverified. Browser harness tests are protocol/browser checks, not proof of ChatGPT account availability or product compatibility. No audio processing, plugin playback or artist-tone match is tested or claimed.

## Manual host acceptance

1. Build, configure stdio in your compatible host with the repo as cwd, and restart it.
2. Call search_amplitube_gear in a text-only client; confirm structured output works independently.
3. Call open_tone_explorer. Confirm the host reads the UI resource and renders the View.
4. Search a real term; verify creator attribution, routing labels, inspect, paging and source-page opening.
5. Select 2–4 captures, compare and check gain/EQ inference labels.
6. Request all three workflow types and verify candidate links, cabinet warnings and manual assembly guidance.
7. Load a rig, edit one field, save, reopen and confirm unedited fields survive.
8. With missing credentials, confirm actionable failure. In a host without tools/openLinks capabilities, confirm graceful fallback.

## Maintenance

The local profile store is single-process; atomic rename prevents partial files but cannot coordinate separate processes. Preserve corrupt data for repair rather than overwriting it. Do not run multiple writable servers against one profile file. Catalog research Python scripts are optional offline maintenance utilities and are never invoked by build/start.

Historical research documents are evidence dated to their original reviews and may mention retired features; current README and architecture docs define supported behavior. The former builder is recoverable in Git history and an external local archive, not a runtime dependency.

Browser screenshots are checked for painted text/control pixels before being saved. This catches intermittent blank iframe raster captures that DOM visibility assertions alone cannot detect. Preview images are evidence of the local harness only.

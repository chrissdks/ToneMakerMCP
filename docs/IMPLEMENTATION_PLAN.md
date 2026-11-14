# Guitar Tone Assistant implementation plan

Goal: retain reliable MCP discovery while replacing preset generation with an
optional React MCP App. Execute inline, incrementally, without approval pauses,
as requested in the supplied modernization brief. Commit locally; do not push.

## Constraints

Node/TypeScript backend; shared logic; official SDK; no fake captures; no frontend
secrets; no public listener; preserve unrelated work and generated user files.

## Milestones

- [x] Audit source, transports, API, recommendations, catalog and profiles; baseline build/tests.
- [x] Preserve existing modifications and create modernize-mcp-app branch.
- [x] Remove builder tool, adapter, submodule, scripts, routes and environment options.
- [x] Extract ToneService orchestration and retain public data contracts.
- [x] Validate API responses and errors; protect profile writes and IDs.
- [x] Register optional UI resource and launch tool with ext-apps 1.7.5.
- [x] Build React explorer, detail, comparison, recommendation chains and rig editor.
- [x] Test backend contracts, malformed API, profiles, local HTTP and View interactions.
- [x] Document architecture, setup, compatibility, security and deployment blockers.
- [x] Review final diff, run all quality gates and commit.

## Review focus and checks

1. Missing or invalid credential: actionable tool error, no token/body reflection.
2. Malformed successful upstream response: rejected before caching/normalization.
3. Overlapping profile writes: serialized across instances in this process; corruption preserved.
4. UI tool error, absent bridge, duplicate submission: visible status, no invented results.
5. Non-UI client and hostile HTTP Host/Origin: core tools preserved; requests rejected.

Test-first workflow: add regression assertions to tests/mcp.test.ts,
tests/reliability.test.ts, tests/http.test.ts and ui/App.test.tsx; observe failures;
implement each boundary; run npm test and npm run build at milestones.

Files: src/application/tone-service.ts owns orchestration; src/tools/register.ts
owns tool contracts; src/server.ts composes registration; src/app.ts serves bundled
UI; src/http-server.ts owns local transport lifecycle; ui/* owns presentation.

## Verification record

2026-11-14: typecheck, backend/UI builds, 41 tests and official AppBridge browser harness pass. Live API search (2 captures) and detail (9 models) validated. npm audit reports zero vulnerabilities. Independent review findings on candidate links, bridge coverage and rig typing were fixed and tested. External product-host rendering remains a manual acceptance item; no deployment or push. Final commit recorded in Git history.

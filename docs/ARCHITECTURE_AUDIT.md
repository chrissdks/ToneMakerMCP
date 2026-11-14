# Architecture audit — 2026-11-14

Baseline: TypeScript build and 24 Vitest tests pass. Nine discovery/profile tools
and one preset tool are registered in a single server module. Stdio and stateless
HTTP instantiate the same server. The catalog and recommendation modules already
have useful independent tests and should be retained.

## Findings
- Tool registration mixes schemas, API orchestration, and response formatting.
- API JSON is cast to interfaces without validating upstream shape.
- Profile reads accept arbitrary objects; concurrent writes can lose updates.
- HTTP trusts Host, has no Origin validation, and can bind publicly without auth.
- Preset compilation checks structure, not musical suitability or plugin playback.
- Artist settings and candidate rankings are heuristics, not listening tests.
- Existing local embedding changes were preserved in commit a86c81a before removal.

## Design
Keep the existing MCP SDK 1.x stack; upgrade Zod to patched 4.6.7. Official ext-apps 1.7.5 declares
SDK ^1.29 and Zod ^3.25/4 peers; ext-apps 2.x requires a coordinated SDK migration.
The documented wire protocol is interoperable. Pin 1.7.5 for this iteration. Dependency audit required Zod 4.6.7 and Vitest 5.1; schema types were adapted and Node minimum raised to 22.12.
Extract application orchestration from tool registration. Add runtime API schemas,
serialized atomic profile writes, loopback HTTP guards, and a separate UI launch
tool. A bundled React View calls existing data tools through the official App bridge.
No separate web API, frontend credentials, database, or public hosting.

## Risks
External host rendering requires manual verification; an SDK mock is not a host.
Local profiles remain single-process data. Multi-user deployment requires identity,
OAuth and per-user storage. Existing generated files are user data and will be
preserved outside the runtime. Remove the builder code and gitlink, not user presets.

# Tone quality evaluations

The automated eval is a deterministic set of 24 realistic requests and synthetic API fixtures. It tests useful, observable criteria: clean headroom and no boost for clean rhythm requests, relevant catalog amps for known heavy examples, requested workflows, amp/cab/IR classification, and double-cab warnings. The Rock With You case uses the user's Pacifica/single-coil context and a clean-rhythm starting point, not a claim about the recording's equipment. Fixture IDs and names are synthetic and are never used in production.

Run `npm run eval:tones` for the 24 cases, or `npm test` for the full suite including these evals. Each case is an individual Vitest test, so the pass/fail report identifies the request and failing criterion. CI runs typecheck, build, and the full suite on pushes and pull requests. No API key or external model is required. These are regression checks, not a measure of audio similarity; the numeric gain thresholds are broad test expectations, not calibrated acoustic measurements.

For an optional live API check, first run `npm run build`, configure `TONE3000_SECRET_KEY` in `.env`, then run `npm run test:live`. This makes real API calls, may be rate-limited, and intentionally does not run in CI. API and catalog changes can affect results; a live failure should be investigated separately from deterministic tests. The script reports counts and safe errors only. Never paste credentials into feedback.

`npm run test:browser` tests the local official MCP Apps bridge and browser harness. It does not prove rendering in the actual ChatGPT host. Follow the manual host checklist in DEVELOPMENT.md when a host is available.

## Listening evaluations

Use the template in [LISTENING_EVAL_TEMPLATE.md](LISTENING_EVAL_TEMPLATE.md) for level-matched listening, and repeat the same riff and pickup settings for comparisons. Save personal results locally; avoid committing recordings or private rig information unless deliberately chosen. Ratings are subjective: record the reference and setup, note whether you listened solo or in a mix, and make no claim that the software analyzed audio. Do not convert a preference into an automatic pass threshold until enough real feedback exists.

For A/B comparisons, match perceived output levels, keep the guitar and monitoring chain fixed, and randomize or conceal labels if practical. Report the number of trials, evaluator and variation; preference is not proof of identical sound. The software does not listen to audio. This baseline contains no human ratings yet.

## Growth

Add user-reported failure cases with reproducible inputs and defensible behavioral expectations. Keep independent observations separate from test implementation, and review each case when catalog data changes. The current engine is deterministic; no external LLM judge is necessary. If an AI host's tool selection or response wording needs evaluation later, define a separate end-to-end dataset with recorded prompts, tool calls, model/version, graders, run cost and nondeterminism. Do not treat an AI judge as a substitute for listening.

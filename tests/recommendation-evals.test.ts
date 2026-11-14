import { describe, expect, it, vi } from "vitest";
import { recommendToneChain } from "../src/recommendation/engine.js";
import { troubleshootTone } from "../src/recommendation/troubleshoot.js";
import { classifyCapture, normalizeTone } from "../src/tone3000/normalize.js";
import { Tone3000Client } from "../src/tone3000/client.js";
import type { RecommendationInput } from "../src/recommendation/types.js";
import type { Tone3000Tone } from "../src/tone3000/types.js";

// The labels encode practical requirements, not listening results or exact studio rigs.
const cleanCases: RecommendationInput[] = [
  {
    target: "Rock With You by Michael Jackson",
    guitarType: "Yamaha Pacifica 612",
    pickupType: "single coil",
    tuning: "standard",
  },
  { target: "rock with you clean rhythm", pickupType: "split humbucker" },
  { target: "clean percussive funk rhythm" },
  { target: "clean disco rhythm guitar" },
  { target: "bright clean single coil chords" },
  { target: "Fender clean rhythm" },
  { target: "clean pop chord stabs", pickupType: "single coils" },
  { target: "ambient clean guitar", desiredGain: "clean" },
];
const offline = () =>
  new Tone3000Client({ baseUrl: "https://www.tone3000.com/api/v1" });
const sample = (gear: string, format = "nam"): Tone3000Tone => ({
  id: 42,
  title: "Synthetic test capture",
  gear,
  format,
  url: "https://www.tone3000.com/tones/test-42",
});

describe("recommendation evals: clean target", () => {
  it.each(cleanCases)(
    "$target should have clean headroom without an overdrive boost",
    async (input) => {
      const result = await recommendToneChain(offline(), {
        ...input,
        preferredWorkflow: "amplitube",
      });
      const approach = result.approaches[0];
      expect(approach.amplitubeGear.map((g) => g.id)).toContain(
        "amp-american-tube-clean",
      );
      expect(approach.settings.gain).toBeLessThanOrEqual(4);
      expect(approach.settings.odLevel).toBeUndefined();
      expect(result.caveats.join(" ")).toMatch(
        /starting points|approximation/i,
      );
    },
  );
});

describe("recommendation evals: high-gain targets", () => {
  it.each([
    ["Metallica Black Album rhythm", "amp-metal-lead-t"],
    ["Alice in Chains Dirt rhythm", "amp-sld-100"],
    ["5150 tight modern metal", "amp-sj50"],
    ["6505 modern rhythm", "amp-sj50"],
  ])(
    "%s selects relevant catalog amp and states approximations",
    async (target, ampId) => {
      const result = await recommendToneChain(offline(), {
        target,
        preferredWorkflow: "amplitube",
      });
      expect(result.approaches[0].amplitubeGear.map((g) => g.id)).toContain(
        ampId,
      );
      expect(result.caveats.join(" ")).toMatch(/approximation/i);
    },
  );
});

describe("recommendation evals: requested workflows", () => {
  it.each([
    ["tone3000", "clean capture"],
    ["amplitube", "clean rhythm"],
    ["hybrid", "5150 cabinet IR"],
    ["amplitube", "Metallica rhythm"],
  ] as const)(
    "%s stays within explicitly requested workflow",
    async (workflow, target) => {
      let calls = 0;
      const client = new Tone3000Client({
        baseUrl: "https://www.tone3000.com/api/v1",
        secretKey: "test",
        fetchImpl: vi.fn(async () => {
          calls++;
          return Response.json({
            data: [],
            page: 1,
            page_size: 10,
            total: 0,
            total_pages: 0,
          });
        }),
      });
      const result = await recommendToneChain(client, {
        target,
        preferredWorkflow: workflow,
      });
      expect(result.approaches.map((a) => a.workflow)).toEqual([workflow]);
      expect(result.recommendedWorkflow).toBe(workflow);
      if (workflow === "amplitube") expect(calls).toBe(0);
      if (workflow === "hybrid")
        expect(result.approaches[0].gainStaging.join(" ")).toMatch(
          /disable.*cabinet/i,
        );
    },
  );
});

describe("recommendation evals: capture routing", () => {
  it.each([
    ["amp", "nam", "amp-head", true, false],
    ["amp-cab", "nam", "amp-and-cab", false, true],
    ["cab", "ir", "cabinet-ir", false, true],
    ["experimental", "nam", "experimental", false, false],
  ] as const)(
    "%s/%s is classified without inventing stages",
    (gear, format, kind, needsCab, hasCab) => {
      const tone = normalizeTone(sample(gear, format));
      expect(classifyCapture(sample(gear, format))).toBe(kind);
      expect(tone.requiresCabOrIr).toBe(needsCab);
      expect(tone.alreadyContainsCabinet).toBe(hasCab);
      if (hasCab) expect(tone.cabWarning).toMatch(/cab/i);
    },
  );
  it.each([
    ["amp", "nam", /cab\/ir/i, false],
    ["amp-cab", "nam", /amp-and-cab/i, true],
  ])(
    "%s chain applies cabinet routing",
    async (gear, format, expected, includesCab) => {
      const raw = sample(gear, format);
      const client = new Tone3000Client({
        baseUrl: "https://www.tone3000.com/api/v1",
        secretKey: "test",
        fetchImpl: vi.fn(async () =>
          Response.json({
            data: [raw],
            page: 1,
            page_size: 8,
            total: 1,
            total_pages: 1,
          }),
        ),
      });
      const approach = (
        await recommendToneChain(client, {
          target: "clean",
          preferredWorkflow: "tone3000",
        })
      ).approaches[0];
      expect(approach.signalChain.join(" ")).toMatch(expected);
      if (includesCab) {
        expect(approach.warnings.join(" ")).toMatch(/cabinet/i);
        expect(approach.signalChain).not.toContain("Cab/IR");
      } else expect(approach.signalChain).toContain("Cab/IR");
    },
  );
  it.each([
    ["amp+cab capture -> cab IR", "muddy"],
    ["full rig -> cabinet", "harsh"],
  ])("warns when %s may double the cabinet", (rig, problem) =>
    expect(troubleshootTone(rig, problem).warning).toMatch(
      /cabinet coloration twice/i,
    ),
  );
});

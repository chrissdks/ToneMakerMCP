import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  amplitubeCatalogMetadata,
  searchAmplitubeGearPage,
} from "../amplitube/search.js";
import { troubleshootTone } from "../recommendation/troubleshoot.js";
import { Tone3000Error } from "../tone3000/errors.js";
import { normalizeTone, rankTones } from "../tone3000/normalize.js";
import {
  TONE3000_ARCHITECTURES,
  TONE3000_GEARS,
  TONE3000_SORTS,
} from "../tone3000/types.js";

import { ToneService } from "../application/tone-service.js";
import { profileSchema, profileIdSchema } from "../profile/schema.js";
import type { ServerDependencies } from "../server.js";
const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;
const externalReadAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const;
const textArray = z.array(z.string()).max(12);
function result(data: Record<string, unknown>, message: string) {
  return {
    structuredContent: data,
    content: [{ type: "text" as const, text: message }],
  };
}

function errorResult(error: unknown) {
  const message =
    error instanceof Tone3000Error || error instanceof Error
      ? error.message
      : "The tool failed unexpectedly.";
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

export function registerToneTools(
  server: McpServer,
  deps: ServerDependencies,
): void {
  const service = new ToneService(deps.tone3000);
  server.registerTool(
    "search_tone3000",
    {
      title: "Search TONE3000",
      description:
        "Search authenticated TONE3000 tone packs and rank results for an amp family, style, artist, song, tags, and required capture type. Returns direct tone-page links, not model downloads.",
      inputSchema: {
        query: z.string().min(1).max(200),
        category: z.enum([...TONE3000_GEARS, "cabinet-ir"]).optional(),
        ampMake: z.string().min(1).max(100).optional(),
        tags: textArray.optional(),
        gain: z.enum(["clean", "crunch", "high-gain"]).optional(),
        artistOrStyleKeywords: textArray.optional(),
        sort: z.enum(TONE3000_SORTS).default("best-match"),
        architecture: z.enum(TONE3000_ARCHITECTURES).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(25).default(10),
      },
      outputSchema: {
        results: z.array(
          z
            .object({
              id: z.number(),
              title: z.string(),
              captureType: z.string(),
              directUrl: z.string(),
            })
            .passthrough(),
        ),
        page: z.number(),
        total: z.number(),
        limitation: z.string().nullable(),
      },
      annotations: externalReadAnnotations,
    },
    async (input) => {
      try {
        const { results, page, total } = await service.search(input);
        return result(
          {
            results,
            page,
            total,
            limitation: results.length
              ? null
              : "No results. Exact make/tag filters may be too narrow; retry with fewer filters or use TONE3000's Select OAuth flow.",
          },
          `Found ${results.length} TONE3000 tone pack${results.length === 1 ? "" : "s"}.`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "get_tone3000_tone",
    {
      title: "Get TONE3000 tone details",
      description:
        "Resolve a TONE3000 tone ID or URL, classify its captured stages, and list its models and authenticated model download URLs.",
      inputSchema: {
        tone: z.union([z.string().min(1), z.number().int().positive()]),
        architecture: z.enum(TONE3000_ARCHITECTURES).optional(),
      },
      outputSchema: {
        tone: z
          .object({
            id: z.number(),
            title: z.string(),
            captureType: z.string(),
            directUrl: z.string(),
            models: z.array(
              z
                .object({
                  id: z.number(),
                  name: z.string(),
                  model_url: z.string(),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      },
      annotations: externalReadAnnotations,
    },
    async ({ tone, architecture }) => {
      try {
        const normalized = await service.detail(tone, architecture);
        return result(
          { tone: normalized },
          `${normalized.title} is classified as ${normalized.captureType}.${normalized.requiresCabOrIr ? " Add a cab or IR afterward." : normalized.cabWarning ? ` ${normalized.cabWarning}` : ""}`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "search_tone3000_cabs",
    {
      title: "Search TONE3000 cabinet IRs",
      description:
        "Find TONE3000 cabinet/IR tone packs by speaker, cabinet size, and tonal character. Returns direct tone-page links.",
      inputSchema: {
        speakerType: z.string().max(100).optional(),
        cabinetSize: z.string().max(50).optional(),
        character: z
          .enum([
            "bright",
            "dark",
            "tight",
            "vintage",
            "modern",
            "warm",
            "balanced",
          ])
          .optional(),
        pageSize: z.number().int().min(1).max(25).default(10),
      },
      outputSchema: {
        results: z.array(
          z
            .object({
              id: z.number(),
              title: z.string(),
              captureType: z.string(),
              directUrl: z.string(),
            })
            .passthrough(),
        ),
        limitation: z.string().nullable(),
      },
      annotations: externalReadAnnotations,
    },
    async (input) => {
      try {
        const query = [
          input.speakerType,
          input.cabinetSize,
          input.character,
          "cabinet IR",
        ]
          .filter(Boolean)
          .join(" ");
        const response = await deps.tone3000.searchTones({
          query,
          gears: ["cab"],
          format: "ir",
          sort: "best-match",
          pageSize: input.pageSize,
        });
        const results = rankTones(response.data.map(normalizeTone), {
          query,
          desiredGear: ["cab"],
        });
        return result(
          {
            results,
            limitation: results.length
              ? null
              : "No IRs matched. Try removing speaker or character terms.",
          },
          `Found ${results.length} cabinet/IR candidate${results.length === 1 ? "" : "s"}.`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "search_amplitube_gear",
    {
      title: "Search AmpliTube 5 MAX gear",
      description:
        "Search the complete, versioned 435-model AmpliTube 5 MAX v2 inventory by gear type, official name, alias, hardware basis, amp family, gain level, or curated style. Mapping confidence distinguishes official facts from inference and unresolved identities.",
      inputSchema: {
        gearType: z
          .enum([
            "amp",
            "cabinet",
            "speaker",
            "microphone",
            "stomp",
            "rack",
            "room",
          ])
          .optional(),
        ampFamily: z.string().max(100).optional(),
        gainClass: z
          .enum(["clean", "crunch", "high-gain", "utility"])
          .optional(),
        keywords: textArray.optional(),
        offset: z.number().int().min(0).default(0),
        limit: z.number().int().min(1).max(50).default(25),
      },
      outputSchema: {
        results: z.array(
          z
            .object({
              id: z.string(),
              displayName: z.string(),
              type: z.string(),
              mappingConfidence: z.string(),
            })
            .passthrough(),
        ),
        totalMatches: z.number(),
        offset: z.number(),
        limit: z.number(),
        hasMore: z.boolean(),
        dataScope: z.string(),
      },
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      const page = searchAmplitubeGearPage(input);
      const metadata = amplitubeCatalogMetadata();
      return result(
        {
          ...page,
          dataScope: `${metadata.product} inventory ${metadata.inventoryVersion}: ${metadata.total} official included-model records. Detailed controls and tonal curation are currently richer for the core recommendation set.`,
        },
        `Returned ${page.results.length} of ${page.totalMatches} matching AmpliTube gear item${page.totalMatches === 1 ? "" : "s"} from offset ${page.offset}.`,
      );
    },
  );

  server.registerTool(
    "recommend_tone_chain",
    {
      title: "Recommend a guitar tone chain",
      description:
        "Choose and explain a primary delivery workflow, then provide TONE3000 capture candidates, exact AmpliTube-only instructions, and/or an AmpliTube amp paired with a TONE3000 cabinet IR.",
      inputSchema: {
        target: z.string().min(1).max(250),
        guitarType: z.string().max(100).optional(),
        pickupType: z.string().max(100).optional(),
        tuning: z.string().max(50).optional(),
        desiredGain: z.enum(["clean", "crunch", "high-gain"]).optional(),
        preferredWorkflow: z
          .enum(["tone3000", "amplitube", "hybrid"])
          .optional(),
        priority: z
          .enum([
            "ready-to-play",
            "maximum-tweakability",
            "cabinet-flexibility",
          ])
          .optional(),
        ownsAmplitube5Max: z.boolean().optional(),
        tone3000PluginInstalled: z.boolean().optional(),
      },
      outputSchema: {
        target: z.string(),
        interpretation: z.string(),
        preferredWorkflow: z.string().nullable(),
        recommendedWorkflow: z.string(),
        decision: z.string(),
        approaches: z.array(
          z.object({
            workflow: z.string(),
            deliveryKind: z.string(),
            title: z.string(),
            signalChain: z.array(z.string()),
            tone3000Models: z.array(z.unknown()),
            amplitubeGear: z.array(z.unknown()),
            settings: z
              .object({
                input: z.string(),
                gain: z.number(),
                bass: z.number(),
                mid: z.number(),
                treble: z.number(),
                presence: z.number(),
              })
              .passthrough(),
            cabRecommendation: z.string(),
            gainStaging: z.array(z.string()),
            rationale: z.array(z.string()),
            warnings: z.array(z.string()),
          }),
        ),
        caveats: z.array(z.string()),
        tone3000Status: z.string(),
      },
      annotations: externalReadAnnotations,
    },
    async (input) => {
      try {
        const recommendation = await service.recommend(input);
        return result(
          recommendation as unknown as Record<string, unknown>,
          `Recommended workflow: ${recommendation.recommendedWorkflow}. ${recommendation.decision} ${recommendation.approaches.length} practical approach${recommendation.approaches.length === 1 ? "" : "es"} prepared. ${recommendation.tone3000Status}`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "troubleshoot_tone",
    {
      title: "Troubleshoot a guitar tone",
      description:
        "Return prioritized, exact changes for fizzy, muddy, thin, harsh, boomy, over-compressed, or slow/soft attack problems while checking for accidental double-cab routing.",
      inputSchema: {
        currentRig: z.string().min(1).max(1000),
        problem: z.string().min(1).max(150),
      },
      outputSchema: {
        problem: z.string(),
        currentRig: z.string(),
        adjustments: z.array(
          z.object({
            priority: z.number(),
            action: z.string(),
            exactChange: z.string(),
            why: z.string(),
          }),
        ),
        warning: z.string().nullable(),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ currentRig, problem }) => {
      const diagnosis = troubleshootTone(currentRig, problem);
      return result(
        diagnosis,
        `${diagnosis.adjustments.length} prioritized adjustments prepared.${diagnosis.warning ? ` Warning: ${diagnosis.warning}` : ""}`,
      );
    },
  );

  server.registerTool(
    "compare_tones",
    {
      title: "Compare TONE3000 tones",
      description:
        "Compare two to four TONE3000 tone packs by gain clues, EQ clues, cab requirements, flexibility, and likely use. Uses metadata conservatively and returns direct links.",
      inputSchema: {
        tones: z
          .array(z.union([z.string().min(1), z.number().int().positive()]))
          .min(2)
          .max(4),
        architecture: z.enum(TONE3000_ARCHITECTURES).optional(),
      },
      outputSchema: {
        rows: z.array(
          z.object({
            id: z.number(),
            title: z.string(),
            directUrl: z.string(),
            gainStructure: z.string(),
            eqCharacter: z.string(),
            cabRequirement: z.string(),
            flexibility: z.string(),
            likelyUse: z.string(),
          }),
        ),
        guidance: z.array(z.string()),
      },
      annotations: externalReadAnnotations,
    },
    async ({ tones, architecture }) => {
      try {
        const comparison = await service.compare(tones, architecture);
        return result(
          comparison,
          `Compared ${comparison.rows.length} TONE3000 tone packs.`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  const profileShape = profileSchema.shape;

  server.registerTool(
    "get_user_tone_profile",
    {
      title: "Get local tone profile",
      description:
        "Read an optional local profile containing guitars, pickups, tunings, interface, favorite amps/IRs, and monitoring device.",
      inputSchema: { profileId: profileIdSchema.default("default") },
      outputSchema: { profile: z.object(profileShape).nullable() },
      annotations: readOnlyAnnotations,
    },
    async ({ profileId }) => {
      try {
        const profile = await deps.profiles.get(profileId);
        return result(
          { profile },
          profile
            ? `Loaded local tone profile ${profileId}.`
            : `No local tone profile named ${profileId} exists.`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    "save_user_tone_profile",
    {
      title: "Save local tone profile",
      description:
        "Replace an optional local tone profile. This writes only to the server's local profile store and never sends profile data to TONE3000.",
      inputSchema: {
        profileId: profileIdSchema.default("default"),
        profile: z.object(profileShape),
      },
      outputSchema: { profile: z.object(profileShape) },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ profileId, profile }) => {
      try {
        const saved = await deps.profiles.save(profile, profileId);
        return result(
          { profile: saved },
          `Saved local tone profile ${profileId}.`,
        );
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

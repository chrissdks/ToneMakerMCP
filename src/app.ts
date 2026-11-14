import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";

export const EXPLORER_URI = "ui://guitar-tone-assistant/explorer.html";
/** UI launch is separate from data operations so searches do not recreate the View. */
export function registerToneApp(server: McpServer): void {
  registerAppTool(
    server,
    "open_tone_explorer",
    {
      title: "Open Tone Explorer",
      description:
        "Open an optional interactive capture explorer, comparison and manual signal-chain workshop. Text-only clients can use the ordinary data tools.",
      inputSchema: { query: z.string().max(200).optional() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: EXPLORER_URI } },
    },
    async ({ query }) => ({
      structuredContent: { query: query ?? "" },
      content: [
        {
          type: "text",
          text: "Tone Explorer is ready in MCP Apps-compatible hosts. Otherwise use search_tone3000, get_tone3000_tone, compare_tones, and recommend_tone_chain. All tone assembly is manual.",
        },
      ],
    }),
  );
  registerAppResource(
    server,
    "Tone Explorer",
    EXPLORER_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const built = import.meta.url.endsWith(".ts")
        ? new URL("../dist/ui/index.html", import.meta.url)
        : new URL("../ui/index.html", import.meta.url);
      let html: string;
      try {
        html = await readFile(fileURLToPath(built), "utf8");
      } catch {
        html =
          '<!doctype html><html lang="en"><body><h1>Tone Explorer is not built</h1><p>Run npm run build:ui, then reopen this view. The text MCP tools remain available.</p></body></html>';
      }
      return {
        contents: [
          {
            uri: EXPLORER_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                csp: { connectDomains: [], resourceDomains: [] },
                prefersBorder: true,
              },
            },
          },
        ],
      };
    },
  );
}

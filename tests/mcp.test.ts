import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { ProfileStore } from "../src/profile/store.js";
import { createGuitarToneServer } from "../src/server.js";
import { Tone3000Client } from "../src/tone3000/client.js";

describe("MCP integration", () => {
  it("lists tools and calls the offline AmpliTube search over MCP", async () => {
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const server = createGuitarToneServer({
      tone3000: new Tone3000Client({
        baseUrl: "https://www.tone3000.com/api/v1",
      }),
      profiles: new ProfileStore(".cache/test-profiles.json"),
    });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    const tools = await client.listTools();
    const launch = tools.tools.find(
      (tool) => tool.name === "open_tone_explorer",
    );
    expect(launch?._meta).toMatchObject({
      ui: { resourceUri: "ui://guitar-tone-assistant/explorer.html" },
    });
    const resources = await client.listResources();
    expect(resources.resources.map((resource) => resource.uri)).toContain(
      "ui://guitar-tone-assistant/explorer.html",
    );
    const view = await client.readResource({
      uri: "ui://guitar-tone-assistant/explorer.html",
    });
    expect(view.contents[0].mimeType).toBe("text/html;profile=mcp-app");
    expect(view.contents[0]._meta).toMatchObject({
      ui: { csp: { connectDomains: [], resourceDomains: [] } },
    });
    expect("text" in view.contents[0] ? view.contents[0].text : "").toContain("<html");
    const launched = await client.callTool({
      name: "open_tone_explorer",
      arguments: { query: "clean" },
    });
    expect(launched.structuredContent).toMatchObject({ query: "clean" });
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "search_tone3000",
        "get_tone3000_tone",
        "search_tone3000_cabs",
        "search_amplitube_gear",
        "recommend_tone_chain",
        "troubleshoot_tone",
        "compare_tones",
        "get_user_tone_profile",
        "save_user_tone_profile",
      ]),
    );

    expect(tools.tools.map((t) => t.name)).not.toContain(
      "create_tone3000_plugin_preset",
    );
    const response = await client.callTool({
      name: "search_amplitube_gear",
      arguments: { gearType: "amp", ampFamily: "5150" },
    });
    expect(response.isError).not.toBe(true);
    expect(response.structuredContent).toMatchObject({
      dataScope: expect.stringContaining("435 official included-model records"),
    });

    await client.close();
    await server.close();
  });
});

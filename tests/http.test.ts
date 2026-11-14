import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createLocalHttpServer } from "../src/http-server.js";
import { Tone3000Client } from "../src/tone3000/client.js";
import { ProfileStore } from "../src/profile/store.js";
import { get, type Server } from "node:http";
const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((r) => {
          s.closeAllConnections();
          s.close(() => r());
        }),
    ),
  );
});
async function start() {
  const server = createLocalHttpServer({
    tone3000: new Tone3000Client({
      baseUrl: "https://www.tone3000.com/api/v1",
    }),
    profiles: new ProfileStore(".cache/http-test.json"),
  });
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No address");
  return `http://127.0.0.1:${address.port}`;
}
describe("local HTTP", () => {
  it("rejects browser cross-origin and hostile Host requests", async () => {
    const url = await start();
    expect(
      (await fetch(url, { headers: { origin: "https://evil.example" } }))
        .status,
    ).toBe(403);
    const status = await new Promise<number | undefined>((resolve, reject) => {
      get(url, { headers: { host: "evil.example" } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      }).on("error", reject);
    });
    expect(status).toBe(403);
    expect((await fetch(url + "/presets/anything")).status).toBe(404);
  });
  it("initializes and calls tools using the actual HTTP MCP transport", async () => {
    const url = await start();
    const client = new Client({ name: "http-test", version: "1" });
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(url + "/mcp")),
      );
      const result = await client.callTool({
        name: "search_amplitube_gear",
        arguments: { gearType: "amp", limit: 1 },
      });
      expect(result.isError).not.toBe(true);
    } finally {
      await client.close();
    }
  });
});

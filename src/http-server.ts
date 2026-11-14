import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createGuitarToneServer, type ServerDependencies } from "./server.js";

/** Local-only transport. Public hosting requires a separate authenticated boundary. */
export function createLocalHttpServer(deps: ServerDependencies) {
  let windowStart = Date.now();
  let requests = 0;
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    const host = req.headers.host ?? "";
    const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
    let url: URL;
    try {
      url = new URL(req.url ?? "/", `http://${host}`);
    } catch {
      res.writeHead(400).end("Invalid request URL");
      return;
    }
    if (
      !allowedHosts.has(url.hostname) ||
      !allowedHosts.has(new URL(`http://${host}`).hostname)
    ) {
      res.writeHead(403).end("Local Host required");
      return;
    }
    if (req.headers.origin && req.headers.origin !== `http://${host}`) {
      res.writeHead(403).end("Cross-origin requests are disabled");
      return;
    }
    if (Date.now() - windowStart > 60_000) {
      windowStart = Date.now();
      requests = 0;
    }
    if (++requests > 120) {
      res
        .writeHead(429, { "Retry-After": "60" })
        .end("Local request limit reached");
      return;
    }
    if (req.method === "GET" && url.pathname === "/") {
      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(
          JSON.stringify({
            name: "Guitar Tone Assistant",
            status: "ok",
            mcp: "/mcp",
          }),
        );
      return;
    }
    if (url.pathname !== "/mcp") {
      res.writeHead(404).end("Not Found");
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" }).end("Stateless MCP accepts POST");
      return;
    }
    if (Number(req.headers["content-length"] ?? 0) > 1024 * 1024) {
      res.writeHead(413).end("Request too large");
      return;
    }
    const server = createGuitarToneServer(deps);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.once("close", () => {
      void server.close().catch(() => undefined);
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end("MCP request failed");
    }
  });
}

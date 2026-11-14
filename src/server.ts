import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ProfileStore } from "./profile/store.js";
import { Tone3000Client } from "./tone3000/client.js";
import { registerToneTools } from "./tools/register.js";
import { registerToneApp } from "./app.js";
export interface ServerDependencies {
  tone3000: Tone3000Client;
  profiles: ProfileStore;
}
/** Compose the same application tools for stdio and local HTTP clients. */
export function createGuitarToneServer(deps: ServerDependencies): McpServer {
  const server = new McpServer(
    { name: "guitar-tone-assistant", version: "0.3.0" },
    {
      instructions:
        "Discover captures and assemble tones manually. Amp-only captures require a cab/IR; amp+cab captures do not. NAM is not an IR. Recommendations are metadata heuristics, not verified artist tones. No audio playback, DAW control or preset generation.",
    },
  );
  registerToneTools(server, deps);
  registerToneApp(server);
  return server;
}

import { loadConfig } from "./config.js";
import { ProfileStore } from "./profile/store.js";
import { Tone3000Client } from "./tone3000/client.js";
import { createLocalHttpServer } from "./http-server.js";
const config = loadConfig();
if (!["127.0.0.1", "::1", "localhost"].includes(config.host))
  throw new Error(
    "HTTP is local-only. Public hosting requires caller authentication and per-user isolation.",
  );
const server = createLocalHttpServer({
  tone3000: new Tone3000Client(config.tone3000),
  profiles: new ProfileStore(config.profileStorePath),
});
server.listen(config.port, config.host, () =>
  console.error(
    "Guitar Tone Assistant local HTTP ready on port " + config.port,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });

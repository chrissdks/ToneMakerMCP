import { loadConfig } from "../dist/src/config.js";
import { ToneService } from "../dist/src/application/tone-service.js";
import { Tone3000Client } from "../dist/src/tone3000/client.js";
const config = loadConfig();
if (!config.tone3000.secretKey) {
  console.error("TONE3000_SECRET_KEY is required. Add it to your local .env.");
  process.exit(1);
}
try {
  const service = new ToneService(new Tone3000Client(config.tone3000));
  const result = await service.search({ query: "Fender clean", pageSize: 1 });
  if (!result.results.length) {
    console.error("No live search results; retry or inspect the API.");
    process.exitCode = 1;
  } else {
    const detail = await service.detail(result.results[0].id);
    console.log(
      "Live search and detail succeeded; returned " +
        detail.models.length +
        " models.",
    );
  }
} catch (error) {
  console.error("Live check failed: " + (error?.message ?? "Unknown error"));
  process.exitCode = 1;
}

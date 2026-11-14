import { describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Tone3000Client } from "../src/tone3000/client.js";
import { ProfileStore } from "../src/profile/store.js";
import { parseToneId } from "../src/tone3000/normalize.js";

describe("API boundaries", () => {
  it("accepts string creator identifiers from the live API", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        data: [
          {
            id: 42,
            title: "Clean",
            gear: "amp",
            format: "nam",
            url: "https://www.tone3000.com/tones/clean-42",
            user: { id: "creator-uuid", username: "creator" },
          },
        ],
        page: 1,
        page_size: 1,
        total: 1,
        total_pages: 1,
      }),
    );
    const client = new Tone3000Client({
      baseUrl: "https://www.tone3000.com/api/v1",
      secretKey: "test",
      fetchImpl,
    });
    expect((await client.searchTones({})).data[0].user?.id).toBe(
      "creator-uuid",
    );
  });
  it("rejects malformed success before caching", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ data: [{ id: 1 }], page: 1 }),
    );
    const client = new Tone3000Client({
      baseUrl: "https://www.tone3000.com/api/v1",
      secretKey: "secret",
      fetchImpl,
    });
    await expect(client.searchTones({})).rejects.toMatchObject({
      code: "invalid_response",
    });
    await expect(client.searchTones({})).rejects.toMatchObject({
      code: "invalid_response",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 429, 500])(
    "does not retry or expose upstream error bodies (%i)",
    async (status) => {
      const fetchImpl = vi.fn(
        async () => new Response("secret-body", { status }),
      );
      const client = new Tone3000Client({
        baseUrl: "https://www.tone3000.com/api/v1",
        secretKey: "secret",
        fetchImpl,
      });
      await expect(client.searchTones({})).rejects.not.toThrow("secret-body");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );
  it("accepts official slug URLs and rejects zero IDs", () => {
    expect(parseToneId("https://www.tone3000.com/tones/5150-47176")).toBe(
      47176,
    );
    expect(() => parseToneId("0")).toThrow();
  });
});

describe("profile persistence", () => {
  it("does not lose simultaneous writes across instances", async () => {
    const file = path.join(
      await mkdtemp(path.join(tmpdir(), "tone-profile-")),
      "profiles.json",
    );
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        new ProfileStore(file).save({ guitars: [`Guitar ${i}`] }, `p${i}`),
      ),
    );
    expect(Object.keys(JSON.parse(await readFile(file, "utf8")))).toHaveLength(
      12,
    );
  });
  it("rejects reserved IDs and corrupt documents without replacing them", async () => {
    const file = path.join(
      await mkdtemp(path.join(tmpdir(), "tone-profile-")),
      "profiles.json",
    );
    const store = new ProfileStore(file);
    await expect(store.save({}, "__proto__")).rejects.toThrow();
    await writeFile(file, '{"default": 42}');
    await expect(store.save({ guitars: ["Test"] })).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe('{"default": 42}');
  });
});

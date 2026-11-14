import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { profileSchema, profileIdSchema, type UserProfile } from "./schema.js";
export type { UserProfile } from "./schema.js";
const writes = new Map<string, Promise<unknown>>();

type ProfileDocument = Record<string, UserProfile>;

export class ProfileStore {
  constructor(private readonly filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async get(profileId = "default"): Promise<UserProfile | null> {
    profileIdSchema.parse(profileId);
    await writes.get(this.filePath)?.catch(() => undefined);
    const profiles = await this.readAll();
    return Object.hasOwn(profiles, profileId) ? profiles[profileId] : null;
  }

  async save(
    profile: UserProfile,
    profileId = "default",
  ): Promise<UserProfile> {
    profileIdSchema.parse(profileId);
    const validated = profileSchema.parse(profile);
    const task = (writes.get(this.filePath) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        const profiles = await this.readAll();
        profiles[profileId] = validated;
        await mkdir(path.dirname(this.filePath), { recursive: true });
        const temporaryPath = this.filePath + "." + randomUUID() + ".tmp";
        await writeFile(
          temporaryPath,
          JSON.stringify(profiles, null, 2) + "\n",
          { encoding: "utf8", mode: 0o600, flag: "wx" },
        );
        await rename(temporaryPath, this.filePath);
        return validated;
      });
    writes.set(this.filePath, task);
    try {
      return await task;
    } finally {
      if (writes.get(this.filePath) === task) writes.delete(this.filePath);
    }
  }

  private async readAll(): Promise<ProfileDocument> {
    try {
      const parsed = JSON.parse(
        await readFile(this.filePath, "utf8"),
      ) as unknown;
      return z.record(profileIdSchema, profileSchema).parse(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw new Error("The local profile store could not be read.");
    }
  }
}

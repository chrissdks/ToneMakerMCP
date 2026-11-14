import { Tone3000Client } from "../tone3000/client.js";
import {
  normalizeTone,
  parseToneId,
  rankTones,
} from "../tone3000/normalize.js";
import type {
  Tone3000Architecture,
  Tone3000Gear,
  Tone3000Sort,
} from "../tone3000/types.js";
import { compareNormalizedTones } from "../recommendation/compare.js";
import { recommendToneChain } from "../recommendation/engine.js";
import type { RecommendationInput } from "../recommendation/types.js";
export interface SearchInput {
  query: string;
  category?: Tone3000Gear | "cabinet-ir";
  ampMake?: string;
  tags?: string[];
  gain?: string;
  artistOrStyleKeywords?: string[];
  sort?: Tone3000Sort;
  architecture?: Tone3000Architecture;
  page?: number;
  pageSize?: number;
}
/** Transport-independent discovery orchestration shared by text tools and the View. */
export class ToneService {
  constructor(private readonly client: Tone3000Client) {}
  async search(input: SearchInput) {
    const gears: Tone3000Gear[] | undefined =
      input.category === "cabinet-ir"
        ? ["cab"]
        : input.category
          ? [input.category]
          : undefined;
    const query = [
      input.query,
      input.ampMake,
      input.gain,
      ...(input.artistOrStyleKeywords ?? []),
    ]
      .filter(Boolean)
      .join(" ");
    const response = await this.client.searchTones({
      query,
      gears,
      format: input.category === "cabinet-ir" ? "ir" : undefined,
      tags: input.tags,
      makes: input.ampMake ? [input.ampMake] : undefined,
      sort: input.sort,
      architecture: input.architecture,
      page: input.page,
      pageSize: input.pageSize,
    });
    return {
      results: rankTones(response.data.map(normalizeTone), {
        query,
        desiredGear: gears,
        tags: input.tags,
      }),
      page: response.page,
      total: response.total,
    };
  }
  async detail(tone: string | number, architecture?: Tone3000Architecture) {
    const id = parseToneId(tone);
    const [raw, models] = await Promise.all([
      this.client.getTone(id, architecture),
      this.client.listModels(id, architecture),
    ]);
    return { ...normalizeTone(raw), models: models.data };
  }
  async compare(
    tones: (string | number)[],
    architecture?: Tone3000Architecture,
  ) {
    return compareNormalizedTones(
      await Promise.all(
        tones.map(async (tone) =>
          normalizeTone(
            await this.client.getTone(parseToneId(tone), architecture),
          ),
        ),
      ),
    );
  }
  recommend(input: RecommendationInput) {
    return recommendToneChain(this.client, input);
  }
}

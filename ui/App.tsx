import React, { useEffect, useRef, useState } from "react";
import {
  useApp,
  useHostStyleVariables,
} from "@modelcontextprotocol/ext-apps/react";
import { z } from "zod";
import type { NormalizedTone } from "../src/tone3000/types";
import type { RecommendationResult } from "../src/recommendation/types";
import type { ToneComparisonRow } from "../src/recommendation/compare";
import type { UserProfile } from "../src/profile/schema";

// Sandboxed hosts need not allow native form navigation. Dispatch only the local handler.
function submitLocalForm(form: HTMLFormElement | null) {
  if (form?.reportValidity())
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
}
function localSubmit(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  submitLocalForm(event.currentTarget.form);
}
function localEnter(event: React.KeyboardEvent<HTMLFormElement>) {
  if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
    event.preventDefault();
    submitLocalForm(event.currentTarget);
  }
}
type CallTool = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;
const resultSchema = z.object({
  isError: z.boolean().optional(),
  structuredContent: z.record(z.string(), z.unknown()).optional(),
  content: z
    .array(
      z.object({ type: z.string(), text: z.string().optional() }).passthrough(),
    )
    .optional(),
});
function dataOf(value: unknown) {
  const result = resultSchema.parse(value);
  if (result.isError)
    throw new Error(
      result.content?.find((c) => c.type === "text")?.text ??
        "Tool request failed.",
    );
  if (!result.structuredContent)
    throw new Error(
      "The tool returned no structured data. Try again or use the text tools.",
    );
  return result.structuredContent;
}
function safeToneUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["tone3000.com", "www.tone3000.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

/** Pure presentation boundary: host communication is injected, never direct API fetches. */
export function ToneExplorer({
  callTool,
  openLink,
  initial,
  connected = true,
}: {
  callTool: CallTool;
  openLink: (url: string) => Promise<unknown>;
  initial?: unknown;
  connected?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tones, setTones] = useState<NormalizedTone[]>([]);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<NormalizedTone[]>([]);
  const [detail, setDetail] = useState<NormalizedTone | null>(null);
  const [comparison, setComparison] = useState<{
    rows: ToneComparisonRow[];
    guidance: string[];
  } | null>(null);
  const [target, setTarget] = useState("");
  const [workflow, setWorkflow] = useState("amplitube");
  const [recommendation, setRecommendation] =
    useState<RecommendationResult | null>(null);
  const [profile, setProfile] = useState<UserProfile>({});
  const [rigDraft, setRigDraft] = useState<
    Partial<Record<"guitars" | "pickupTypes" | "tunings", string>>
  >({});
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!initial) return;
    try {
      const data = dataOf(initial);
      if (typeof data.query === "string") setQuery(data.query);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to read initial tool result",
      );
    }
  }, [initial]);
  async function run(action: () => Promise<void>) {
    if (active.current || !connected) return;
    active.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : "Request failed. Please retry.",
        );
    } finally {
      active.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function search(nextPage = 1) {
    await run(async () => {
      const data = dataOf(
        await callTool("search_tone3000", {
          query: query.trim(),
          ...(category ? { category } : {}),
          page: nextPage,
          pageSize: 12,
        }),
      );
      if (!alive.current) return;
      setTones(data.results as NormalizedTone[]);
      setPage(Number(data.page));
      setTotal(Number(data.total));
      setSearched(true);
      setDetail(null);
    });
  }
  const disabled = busy || !connected;
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">GUITAR TONE ASSISTANT</p>
          <h1>Tone workshop</h1>
          <p>
            Discover captures. Compare the details. Build your signal chain.
          </p>
        </div>
        <span className="status-pill">
          {connected ? "MCP connected" : "Waiting for host"}
        </span>
      </header>
      <p className="disclaimer">
        Guidance for manual assembly — no audio playback, preset generation, or
        DAW control.
      </p>
      {!connected && (
        <p role="status">
          Open this interface in an MCP Apps-compatible host. The ordinary MCP
          tools remain available.
        </p>
      )}
      {busy && (
        <p role="status" className="notice">
          Working…
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section aria-labelledby="explorer-title">
        <div className="section-heading">
          <h2 id="explorer-title">01 / Explorer</h2>
          <span>TONE3000 catalog metadata</span>
        </div>
        <form
          onKeyDown={localEnter}
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
          className="search-form"
        >
          <label>
            Search captures
            <input
              aria-label="Search captures"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={200}
              required
              placeholder="Amp, style, or capture name"
            />
          </label>
          <label>
            Capture type
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All types</option>
              <option value="amp">Amp only</option>
              <option value="amp-cab">Amp + cabinet</option>
              <option value="cabinet-ir">Cabinet IR</option>
              <option value="pedal">Pedal</option>
            </select>
          </label>
          <button
            type="button"
            onClick={localSubmit}
            disabled={disabled || !query.trim()}
          >
            Search
          </button>
        </form>
        {!searched && (
          <p className="empty">
            Search to discover live captures. No example results are preloaded.
          </p>
        )}
        {searched && tones.length === 0 && (
          <p className="empty">No captures found. Try a broader search.</p>
        )}
        <div className="cards">
          {tones.map((tone) => (
            <article key={tone.id}>
              <span className="badge">{tone.captureType}</span>
              <h3>{tone.title}</h3>
              <p>By {tone.author ?? "Unknown creator"}</p>
              <p>
                {tone.makes?.join(" · ") || "Amplifier details not supplied"}
              </p>
              <p className="routing">
                {tone.requiresCabOrIr
                  ? "Needs a cabinet / IR"
                  : (tone.cabWarning ?? "Check captured stages before routing")}
              </p>
              <div className="actions">
                <button
                  disabled={disabled}
                  aria-label={`Inspect ${tone.title}`}
                  onClick={() =>
                    void run(async () => {
                      const data = dataOf(
                        await callTool("get_tone3000_tone", { tone: tone.id }),
                      );
                      if (alive.current) setDetail(data.tone as NormalizedTone);
                    })
                  }
                >
                  Inspect
                </button>
                <button
                  disabled={disabled || !safeToneUrl(tone.directUrl)}
                  onClick={() =>
                    void run(async () => {
                      await openLink(tone.directUrl);
                    })
                  }
                >
                  Open TONE3000
                </button>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  aria-label={`Compare ${tone.title}`}
                  checked={selected.some((t) => t.id === tone.id)}
                  disabled={
                    disabled ||
                    (selected.length >= 4 &&
                      !selected.some((t) => t.id === tone.id))
                  }
                  onChange={(e) => {
                    setComparison(null);
                    setSelected(
                      e.target.checked
                        ? [...selected, tone]
                        : selected.filter((t) => t.id !== tone.id),
                    );
                  }}
                />
                Compare
              </label>
            </article>
          ))}
        </div>
        {searched && (
          <div className="actions">
            <button
              disabled={disabled || page <= 1}
              onClick={() => void search(page - 1)}
            >
              Previous
            </button>
            <span>
              Page {page} · {total} matches
            </span>
            <button
              disabled={disabled || page * 12 >= total}
              onClick={() => void search(page + 1)}
            >
              Next
            </button>
          </div>
        )}
        {detail && (
          <aside aria-label="Tone details">
            <h3>{detail.title} — details</h3>
            <p>{detail.description || "No creator description provided."}</p>
            <p>{detail.cabWarning}</p>
            <p>
              Model downloads require authentication. Open TONE3000 to download
              and load manually.
            </p>
            <ul>
              {detail.models?.map((m) => (
                <li key={m.id}>
                  {m.name} · Architecture {m.architecture_version ?? "unknown"}{" "}
                  · {m.size ?? "size unknown"}
                </li>
              ))}
            </ul>
            <button onClick={() => setDetail(null)}>Close details</button>
          </aside>
        )}
      </section>
      <section aria-labelledby="compare-title">
        <div className="section-heading">
          <h2 id="compare-title">02 / Compare</h2>
          <span>Select 2–4 captures</span>
        </div>
        <p>
          {selected.map((t) => t.title).join(" · ") ||
            "Use the Compare checkboxes in Explorer."}
        </p>
        <div className="actions">
          <button
            disabled={disabled || selected.length < 2}
            onClick={() =>
              void run(async () => {
                const data = dataOf(
                  await callTool("compare_tones", {
                    tones: selected.map((t) => t.id),
                  }),
                );
                if (alive.current)
                  setComparison(
                    data as unknown as {
                      rows: ToneComparisonRow[];
                      guidance: string[];
                    },
                  );
              })
            }
          >
            Compare selected ({selected.length})
          </button>
          <button
            disabled={disabled || !selected.length}
            onClick={() => {
              setSelected([]);
              setComparison(null);
            }}
          >
            Clear selection
          </button>
        </div>
        {comparison && (
          <>
            <p>
              Gain, EQ and use-case descriptions are metadata-based inferences,
              not listening measurements.
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Capture</th>
                    <th>Cabinet & routing</th>
                    <th>Gain / EQ clues</th>
                    <th>Flexibility & use</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.rows.map((row) => (
                    <tr key={row.id}>
                      <th>{row.title}</th>
                      <td>{row.cabRequirement}</td>
                      <td>
                        {row.gainStructure}
                        <br />
                        {row.eqCharacter}
                      </td>
                      <td>
                        {row.flexibility}
                        <br />
                        {row.likelyUse}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul>
              {comparison.guidance.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section aria-labelledby="chain-title">
        <div className="section-heading">
          <h2 id="chain-title">03 / Signal chain</h2>
          <span>Heuristic starting points</span>
        </div>
        <form
          onKeyDown={localEnter}
          className="search-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const data = dataOf(
                await callTool("recommend_tone_chain", {
                  target: target.trim(),
                  preferredWorkflow: workflow,
                  guitarType: profile.guitars?.[0],
                  pickupType: profile.pickupTypes?.[0],
                  tuning: profile.tunings?.[0],
                  ownsAmplitube5Max: profile.ownsAmplitube5Max,
                }),
              );
              if (alive.current)
                setRecommendation(data as unknown as RecommendationResult);
            });
          }}
        >
          <label>
            Tone target
            <input
              aria-label="Tone target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              maxLength={250}
              required
              placeholder="Clean rhythm, tight metal…"
            />
          </label>
          <label>
            Workflow
            <select
              value={workflow}
              onChange={(e) => setWorkflow(e.target.value)}
            >
              <option value="amplitube">AmpliTube</option>
              <option value="tone3000">TONE3000 / NAM</option>
              <option value="hybrid">AmpliTube + IR</option>
            </select>
          </label>
          <button
            type="button"
            onClick={localSubmit}
            disabled={disabled || !target.trim()}
          >
            Recommend chain
          </button>
        </form>
        {recommendation && (
          <>
            <p>{recommendation.decision}</p>
            <p>{recommendation.tone3000Status}</p>
            {recommendation.approaches.map((approach) => (
              <article key={approach.workflow}>
                <h3>{approach.title}</h3>
                <ol aria-label="Signal chain" className="signal-chain">
                  {approach.signalChain.map((block, i) => (
                    <li key={`${i}-${block}`}>{block}</li>
                  ))}
                </ol>
                <p>{approach.cabRecommendation}</p>
                <p className="disclaimer">
                  Generic starting settings; only apply controls that your
                  chosen model actually exposes. Captured amp controls cannot be
                  adjusted like an amp simulation.
                </p>
                <dl className="settings">
                  {Object.entries(approach.settings)
                    .filter(([, v]) => typeof v === "number")
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                </dl>
                <ul>
                  {[
                    ...approach.warnings,
                    ...approach.gainStaging,
                    ...approach.rationale,
                  ].map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                <div className="actions">
                  {approach.tone3000Models.map((tone) => (
                    <button
                      key={tone.id}
                      disabled={disabled || !safeToneUrl(tone.directUrl)}
                      aria-label={`Open ${tone.title}`}
                      onClick={() =>
                        void run(async () => {
                          await openLink(tone.directUrl);
                        })
                      }
                    >
                      {tone.title} · {tone.captureType}
                    </button>
                  ))}
                </div>
                <p>
                  Suggested equipment:{" "}
                  {approach.amplitubeGear
                    .map((g) => g.displayName)
                    .join(", ") || "Select and audition captures manually."}
                </p>
              </article>
            ))}
            <ul>
              {recommendation.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section aria-labelledby="rig-title">
        <div className="section-heading">
          <h2 id="rig-title">04 / Your rig</h2>
          <span>Local profile · default</span>
        </div>
        <p>
          Load your saved profile before editing. Saving replaces this profile;
          other supported fields are retained.
        </p>
        <button
          disabled={disabled}
          onClick={() =>
            void run(async () => {
              const data = dataOf(await callTool("get_user_tone_profile", {}));
              if (alive.current) {
                setProfile((data.profile as UserProfile | null) ?? {});
                setRigDraft({});
                setProfileLoaded(true);
                setNotice("Profile loaded.");
              }
            })
          }
        >
          Load rig
        </button>
        {profileLoaded && (
          <form
            onKeyDown={localEnter}
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const savedProfile = { ...profile };
                for (const key of [
                  "guitars",
                  "pickupTypes",
                  "tunings",
                ] as const) {
                  if (rigDraft[key] !== undefined)
                    savedProfile[key] = rigDraft[key]
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean);
                }
                await callTool("save_user_tone_profile", {
                  profile: savedProfile,
                }).then(dataOf);
                if (alive.current) setNotice("Rig saved locally.");
              });
            }}
          >
            <div className="rig-grid">
              {(["guitars", "pickupTypes", "tunings"] as const).map((key) => (
                <label key={key}>
                  {key}
                  <input
                    value={rigDraft[key] ?? profile[key]?.join(", ") ?? ""}
                    onChange={(e) =>
                      setRigDraft({ ...rigDraft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              <label>
                Monitoring
                <input
                  value={profile.outputDevice ?? ""}
                  maxLength={120}
                  onChange={(e) =>
                    setProfile({ ...profile, outputDevice: e.target.value })
                  }
                />
              </label>
            </div>
            <button type="button" onClick={localSubmit} disabled={disabled}>
              Save rig
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

export default function App() {
  const [initial, setInitial] = useState<unknown>();
  const { app, isConnected, error } = useApp({
    appInfo: { name: "Guitar Tone Explorer", version: "0.3.0" },
    capabilities: {},
    onAppCreated: (app) => {
      app.ontoolresult = setInitial;
    },
  });
  useHostStyleVariables(app, app?.getHostContext());
  useEffect(
    () => () => {
      void app?.close();
    },
    [app],
  );
  if (error)
    return (
      <main role="alert">
        Cannot connect to the MCP host: {error.message}. Use search_tone3000,
        compare_tones, and recommend_tone_chain in chat.
      </main>
    );
  return (
    <ToneExplorer
      connected={isConnected && !!app?.getHostCapabilities()?.serverTools}
      initial={initial}
      callTool={async (name, args) => {
        if (!app) throw Error("Host not connected");
        return app.callServerTool({ name, arguments: args });
      }}
      openLink={async (url) => {
        if (!app?.getHostCapabilities()?.openLinks)
          throw Error(
            "This host cannot open links. Open the capture’s TONE3000 page manually.",
          );
        return app.openLink({ url });
      }}
    />
  );
}

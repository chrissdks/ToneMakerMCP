// @vitest-environment jsdom
import React from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { ToneExplorer } from "./App";
afterEach(cleanup);
it("allows typing spaces and comma-separated rig names", async () => {
  const user = userEvent.setup();
  const call = vi.fn(async (name: string, args: Record<string, unknown>) => ({
    structuredContent: {
      profile: name === "get_user_tone_profile" ? {} : args.profile,
    },
  }));
  render(<ToneExplorer callTool={call} openLink={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Load rig" }));
  await user.type(await screen.findByLabelText("guitars"), "Les Paul, Strat");
  await user.click(screen.getByRole("button", { name: "Save rig" }));
  await screen.findByText("Rig saved locally.");
  expect(call).toHaveBeenCalledWith("save_user_tone_profile", {
    profile: { guitars: ["Les Paul", "Strat"] },
  });
});
const tone = (id: number) => ({
  id,
  title: `Capture ${id}`,
  author: "Creator",
  captureType: "amp-head",
  requiresCabOrIr: true,
  directUrl: `https://www.tone3000.com/tones/${id}`,
  makes: ["Test amp"],
  tags: [],
  format: "nam",
});
it("searches real tool results, inspects and compares selected captures", async () => {
  const call = vi.fn(async (name: string) => ({
    structuredContent:
      name === "search_tone3000"
        ? { results: [tone(1), tone(2)], page: 1, total: 2 }
        : name === "get_tone3000_tone"
          ? { tone: { ...tone(1), models: [] } }
          : {
              rows: [
                {
                  id: 1,
                  title: "Comparison result",
                  cabRequirement: "Needs cab",
                },
              ],
              guidance: [],
            },
  }));
  render(<ToneExplorer callTool={call} openLink={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Search captures"), {
    target: { value: "clean" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await screen.findByText("Capture 1");
  expect(call).toHaveBeenCalledWith(
    "search_tone3000",
    expect.objectContaining({ query: "clean" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Inspect Capture 1" }));
  await screen.findByText(
    "Model downloads require authentication. Open TONE3000 to download and load manually.",
  );
  fireEvent.click(screen.getByLabelText("Compare Capture 1"));
  fireEvent.click(screen.getByLabelText("Compare Capture 2"));
  fireEvent.click(screen.getByRole("button", { name: "Compare selected (2)" }));
  await screen.findByText("Comparison result");
});
it("shows loading, empty results, and tool errors", async () => {
  let resolve!: (value: unknown) => void;
  const call = vi.fn(
    () =>
      new Promise<unknown>((r) => {
        resolve = r;
      }),
  );
  render(<ToneExplorer callTool={call} openLink={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Search captures"), {
    target: { value: "clean" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(screen.getByRole("status").textContent).toContain("Working");
  expect(
    (screen.getByRole("button", { name: "Search" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  resolve({ structuredContent: { results: [], page: 1, total: 0 } });
  await screen.findByText("No captures found. Try a broader search.");
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  resolve({
    isError: true,
    content: [{ type: "text", text: "Credentials unavailable" }],
  });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Credentials unavailable",
    ),
  );
});
it("renders recommended chain blocks and warnings as guidance", async () => {
  const call = vi.fn(async () => ({
    structuredContent: {
      approaches: [
        {
          workflow: "amplitube",
          title: "Clean chain",
          signalChain: ["Guitar", "Amp", "Cabinet"],
          warnings: ["Avoid double cabinet"],
          gainStaging: [],
          rationale: [],
          settings: { gain: 3 },
          tone3000Models: [],
          amplitubeGear: [],
          cabRecommendation: "Use one cab",
        },
      ],
      caveats: ["Starting points only"],
    },
  }));
  render(<ToneExplorer callTool={call} openLink={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Tone target"), {
    target: { value: "clean rhythm" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Recommend chain" }));
  await screen.findByText("Clean chain");
  expect(screen.getByText("Avoid double cabinet")).toBeTruthy();
  expect(screen.getByLabelText("Signal chain").textContent).toContain(
    "Cabinet",
  );
});
it("preserves unedited profile fields when saving rig edits", async () => {
  const original = {
    guitars: ["Old guitar"],
    favoriteAmps: ["Keep me"],
    audioInterface: "Interface",
  };
  const call = vi.fn(async (name: string, args: Record<string, unknown>) => ({
    structuredContent: {
      profile: name === "get_user_tone_profile" ? original : args.profile,
    },
  }));
  render(<ToneExplorer callTool={call} openLink={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Load rig" }));
  const input = await screen.findByLabelText("guitars");
  fireEvent.change(input, { target: { value: "New guitar" } });
  fireEvent.click(screen.getByRole("button", { name: "Save rig" }));
  await screen.findByText("Rig saved locally.");
  expect(call).toHaveBeenCalledWith("save_user_tone_profile", {
    profile: { ...original, guitars: ["New guitar"] },
  });
});
it("exposes recommended capture links through the host", async () => {
  const openLink = vi.fn(async () => ({}));
  const call = vi.fn(async () => ({
    structuredContent: {
      approaches: [
        {
          workflow: "tone3000",
          title: "Manual chain",
          signalChain: ["Amp"],
          warnings: [],
          gainStaging: [],
          rationale: [],
          settings: { gain: 3 },
          tone3000Models: [tone(8)],
          amplitubeGear: [],
          cabRecommendation: "Use one cab",
        },
      ],
      caveats: [],
    },
  }));
  render(<ToneExplorer callTool={call} openLink={openLink} />);
  fireEvent.change(screen.getByLabelText("Tone target"), {
    target: { value: "clean" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Recommend chain" }));
  const link = await screen.findByRole("button", { name: "Open Capture 8" });
  fireEvent.click(link);
  await waitFor(() =>
    expect(openLink).toHaveBeenCalledWith("https://www.tone3000.com/tones/8"),
  );
});

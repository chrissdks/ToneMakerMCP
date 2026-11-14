// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({
  connected: true,
  tools: true,
  call: vi.fn(),
  close: vi.fn(),
  created: undefined as undefined | ((app: unknown) => void),
}));
const fakeApp = {
  getHostContext: () => ({ theme: "dark" }),
  getHostCapabilities: () => ({
    serverTools: bridge.tools ? {} : undefined,
    openLinks: {},
  }),
  callServerTool: bridge.call,
  close: bridge.close,
  ontoolresult: undefined as undefined | ((value: unknown) => void),
};
vi.mock("@modelcontextprotocol/ext-apps/react", () => ({
  useHostStyleVariables: vi.fn(),
  useApp: (options: { onAppCreated: (app: unknown) => void }) => {
    bridge.created = options.onAppCreated;
    return { app: fakeApp, isConnected: bridge.connected, error: null };
  },
}));
import App from "./App";
afterEach(() => {
  cleanup();
  bridge.connected = true;
  bridge.tools = true;
});
it("receives initial launch data and calls the host tool protocol", async () => {
  bridge.call.mockResolvedValue({
    structuredContent: { results: [], page: 1, total: 0 },
  });
  const view = render(<App />);
  act(() => {
    bridge.created?.(fakeApp);
    fakeApp.ontoolresult?.({ structuredContent: { query: "clean" } });
  });
  expect(
    (screen.getByLabelText("Search captures") as HTMLInputElement).value,
  ).toBe("clean");
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() =>
    expect(bridge.call).toHaveBeenCalledWith({
      name: "search_tone3000",
      arguments: { query: "clean", page: 1, pageSize: 12 },
    }),
  );
  view.unmount();
  expect(bridge.close).toHaveBeenCalled();
});
it("disables host calls when tool capability is missing", () => {
  bridge.tools = false;
  render(<App />);
  fireEvent.change(screen.getByLabelText("Search captures"), {
    target: { value: "clean" },
  });
  expect(
    (screen.getByRole("button", { name: "Search" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByRole("status").textContent).toContain(
    "MCP Apps-compatible host",
  );
});

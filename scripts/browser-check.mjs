import { paintedPixelCount } from "./screenshot-check.mjs";
import { build } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { chromium, expect } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createGuitarToneServer } from "../dist/src/server.js";
import { Tone3000Client } from "../dist/src/tone3000/client.js";
import { ProfileStore } from "../dist/src/profile/store.js";
await build({
  configFile: false,
  root: "tests/browser",
  plugins: [viteSingleFile()],
  build: {
    outDir: "../../.cache/browser-harness",
    emptyOutDir: true,
    target: "esnext",
  },
});
const [a, b] = InMemoryTransport.createLinkedPair();
const client = new Client({ name: "browser-test", version: "1" });
const server = createGuitarToneServer({
  tone3000: new Tone3000Client({ baseUrl: "https://www.tone3000.com/api/v1" }),
  profiles: new ProfileStore(".cache/browser-profiles.json"),
});
await Promise.all([client.connect(a), server.connect(b)]);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.exposeFunction("mcpCall", (params) => client.callTool(params));
  await page.setContent(
    await readFile(".cache/browser-harness/index.html", "utf8"),
  );
  const view = page.frameLocator("#view");
  await expect(view.getByText("MCP connected")).toBeVisible();
  await expect(view.getByLabel("Search captures")).toHaveValue("clean");
  await view.getByRole("button", { name: "Search", exact: true }).click();
  try {
    await expect(view.getByRole("alert")).toContainText("not configured");
  } catch (e) {
    console.log(await page.frames()[1].locator("body").innerText());
    throw e;
  }
  await view.getByLabel("Tone target").fill("clean rhythm");
  await view.getByRole("button", { name: "Recommend chain" }).click();
  await expect(
    view.getByRole("heading", { name: "AmpliTube 5 MAX-only" }),
  ).toBeVisible();
  await expect(
    view.getByRole("list", { name: "Signal chain", exact: true }),
  ).toBeVisible();
  // A blank raster must fail even if all DOM visibility assertions passed.
  const blank = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1000;
    const context = canvas.getContext("2d");
    context.fillStyle = "#111513";
    context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  expect(await paintedPixelCount(page, Buffer.from(blank, "base64"))).toBe(0);
  async function capturePainted(path) {
    const height = await page
      .frames()[1]
      .evaluate(() => document.documentElement.scrollHeight);
    await page.locator("#view").evaluate((iframe, height) => {
      iframe.style.height = `${height}px`;
    }, height);
    // Let the iframe compositor commit the visible surface before inspecting pixels.
    await page
      .frames()[1]
      .evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
    await page.waitForTimeout(200);
    let png;
    await expect
      .poll(
        async () => {
          png = await page.screenshot({
            fullPage: false,
            animations: "disabled",
          });
          return paintedPixelCount(page, png);
        },
        {
          message: "Screenshot must contain painted UI text and controls",
          timeout: 10000,
        },
      )
      .toBeGreaterThan(1000);
    await writeFile(path, png);
  }
  await mkdir(".cache/browser-checks", { recursive: true });
  await capturePainted(".cache/browser-checks/desktop.png");
  await page.setViewportSize({ width: 390, height: 900 });
  const width = await page.frames()[1].evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: innerWidth,
  }));
  if (width.scroll > width.viewport + 2)
    throw Error("Narrow View overflows horizontally");
  await capturePainted(".cache/browser-checks/mobile.png");
  expect(errors).toEqual([]);
  console.log(
    "PASS: official AppBridge handshake, initial tool result, real missing-credential tool error, real offline recommendation, desktop/narrow layouts.",
  );
} finally {
  await browser.close();
  await client.close();
  await server.close();
}

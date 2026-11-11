import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import {
  renderWithApp,
  type RenderedPluginApp,
} from "@termix-ssh/plugin-sdk/testing";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import * as plugin from "../../src/frontend/index";
import manifestJson from "../../manifest.json";
import locales from "../../locales/en.json";

const manifest = manifestJson as unknown as PluginManifest;

let rendered: RenderedPluginApp | null = null;

afterEach(async () => {
  await rendered?.deactivate();
  rendered = null;
});

describe(`${manifest.id} activate`, () => {
  it("registers the rail item and tab", async () => {
    rendered = await renderWithApp(plugin, { manifest, locales });
    expect(rendered.registered.tabs()).toEqual(["hindsight"]);
    expect(rendered.registered.railItems()).toEqual([
      expect.objectContaining({
        id: "hindsight",
        permission: "hindsight.view",
      }),
    ]);
  });

  it("shows health and the bank's key metrics", async () => {
    rendered = await renderWithApp(plugin, {
      manifest,
      locales,
      api: {
        get: vi.fn(async () => ({
          data: {
            bank: "frankie",
            health: { ok: true, latencyMs: 12 },
            version: "0.9.0",
            statsError: false,
            banks: [{ bank_id: "frankie", name: null }],
            stats: {
              total_nodes: 1234,
              total_links: 5,
              total_documents: 7,
              pending_operations: 0,
              failed_operations: 3,
              last_consolidated_at: null,
              nodes_by_fact_type: { world: 1000, experience: 234 },
            },
          },
        })),
      } as never,
    });
    rendered.renderTab("hindsight", { isVisible: true });
    expect(await screen.findByText(/Healthy/)).toBeTruthy();
    expect(screen.getByText(locales.tab.metrics.memories)).toBeTruthy();
    expect(screen.getByText("1,234")).toBeTruthy();
    expect(screen.getByText("world")).toBeTruthy();
  });

  it("tells the user when Hindsight is not set up", async () => {
    rendered = await renderWithApp(plugin, {
      manifest,
      locales,
      api: {
        get: vi.fn(async () => {
          throw { response: { status: 409 } };
        }),
      } as never,
    });
    rendered.renderTab("hindsight", { isVisible: true });
    expect(await screen.findByText(locales.tab.notConfigured)).toBeTruthy();
  });
});

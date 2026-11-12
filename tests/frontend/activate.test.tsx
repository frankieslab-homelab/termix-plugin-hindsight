import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  renderWithApp,
  type RenderedPluginApp,
} from "@termix-ssh/plugin-sdk/testing";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import type { IconComponent } from "@termix-ssh/plugin-sdk/frontend";
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
  it("offers the existing tab as a phone and tablet WebView", () => {
    expect(manifestJson.contributes.mobile).toEqual({
      mode: "webview",
      views: ["hindsight"],
      sizes: ["phone", "tablet"],
    });
    expect(manifestJson.contributes.tabs.map((tab) => tab.id)).toContain(
      manifestJson.contributes.mobile.views[0],
    );
    expect(manifestJson.engine.api).toBe("^1.13");
  });

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

  it("sizes the sidebar icon using the SDK icon props", async () => {
    let Icon: IconComponent | undefined;
    rendered = await renderWithApp(
      {
        activate(app) {
          const registration = vi.spyOn(app, "registerRailItem");
          plugin.activate(app);
          Icon = registration.mock.calls[0][0].icon;
        },
      },
      { manifest, locales },
    );
    if (!Icon) throw new Error("Sidebar icon was not registered");
    const { container, rerender } = render(
      <Icon size={16} strokeWidth={1.5} className="sidebar-icon" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
    expect(svg?.getAttribute("stroke-width")).toBe("1.5");
    expect(svg?.getAttribute("class")).toBe("sidebar-icon");
    expect(svg?.hasAttribute("size")).toBe(false);

    rerender(<Icon size="1rem" />);
    expect(svg?.getAttribute("width")).toBe("1rem");
    expect(svg?.getAttribute("height")).toBe("1rem");

    rerender(<Icon />);
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
    expect(svg?.getAttribute("stroke-width")).toBe("2");
  });

  it("shows health and the bank's key metrics", async () => {
    rendered = await renderWithApp(plugin, {
      manifest,
      locales,
      api: {
        get: vi.fn(async () => ({
          data: {
            bank: "bank-a",
            health: { ok: true, latencyMs: 12 },
            version: "0.9.0",
            statsError: false,
            banks: [{ bank_id: "bank-a", name: null }],
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

  it("provides a bounded SDK scroll body for the mobile WebView", async () => {
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
    const message = await screen.findByText(locales.tab.notConfigured);
    const scrollBody = message.closest(".overflow-y-auto");
    expect(scrollBody).not.toBeNull();
    expect(scrollBody?.classList.contains("min-h-0")).toBe(true);
    expect(scrollBody?.closest(".h-full")).not.toBeNull();
    expect(message.parentElement?.classList.contains("shrink-0")).toBe(true);
  });

  it("switches banks and refreshes using only the plugin API", async () => {
    const get = vi.fn(
      async (
        _path: string,
        options?: {
          params?: { bank: string };
        },
      ) => ({
        data: {
          bank: options?.params?.bank ?? "bank-a",
          health: { ok: true, latencyMs: 12 },
          version: "0.9.0",
          stats: null,
          statsError: false,
          banks: [
            { bank_id: "bank-a", name: null },
            { bank_id: "bank-b", name: null },
          ],
        },
      }),
    );
    rendered = await renderWithApp(plugin, {
      manifest,
      locales,
      api: { get } as never,
    });
    rendered.renderTab("hindsight", { isVisible: true });
    fireEvent.change(await screen.findByRole("combobox"), {
      target: { value: "bank-b" },
    });
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith("/metrics", {
        params: { bank: "bank-b" },
      }),
    );
    const calls = get.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: locales.tab.refresh }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(calls + 1));
    expect(get.mock.calls.every(([path]) => path === "/metrics")).toBe(true);
  });
});

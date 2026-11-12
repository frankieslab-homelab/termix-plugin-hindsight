import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Router } from "express";
import {
  createMockCtx,
  type MockPluginContext,
} from "@termix-ssh/plugin-sdk/testing";
import type { PluginManifest } from "@termix-ssh/plugin-sdk/manifest";
import manifestJson from "../../manifest.json";
import { activate } from "../../src/backend/index.js";

const manifest = manifestJson as unknown as PluginManifest;

const stats = {
  bank_id: "bank-a",
  total_nodes: 42,
  total_links: 100,
  total_documents: 7,
  pending_operations: 0,
  failed_operations: 1,
  last_consolidated_at: null,
};

let mock: MockPluginContext;
let server: http.Server;
let port: number;
let fetchMock: ReturnType<typeof vi.fn>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

async function start(
  settings: Record<string, unknown>,
  permissions = ["hindsight.view"],
) {
  let router: Router | null = null;
  mock = createMockCtx({
    pluginId: manifest.id,
    manifest,
    capabilities: manifest.capabilities,
    router: () => (router = express.Router()),
    permissions,
    settings,
    fetch: fetchMock as never,
  });
  await activate(mock.ctx);

  const app = express();
  app.use((_req, _res, next) => {
    mock.setActor("user-1");
    next();
  });
  app.use((req, res, next) => router!(req, res, next));
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
}

async function get(path: string) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: response.status, body: await response.json() };
}

beforeEach(() => {
  fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/health")) return json({ status: "healthy" });
    if (url.endsWith("/version")) return json({ api_version: "0.9.0" });
    if (url.endsWith("/v1/default/banks"))
      return json({
        banks: [{ bank_id: "bank-a", name: null, fact_count: 42 }],
      });
    if (url.endsWith("/stats")) return json(stats);
    return json({}, 404);
  });
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("metrics route", () => {
  it("returns health, version, stats and banks, authenticating with the key", async () => {
    await start({
      url: "https://hs.example:8888/",
      apiKey: "k",
      bank: "bank-a",
    });

    const { status, body } = await get("/metrics");

    expect(status).toBe(200);
    expect(body.health.ok).toBe(true);
    expect(body.version).toBe("0.9.0");
    expect(body.stats.total_nodes).toBe(42);
    expect(body.banks).toEqual([
      { bank_id: "bank-a", name: null, fact_count: 42 },
    ]);
    const statsCall = fetchMock.mock.calls.find(([u]) => u.endsWith("/stats"))!;
    expect(statsCall[0]).toBe(
      "https://hs.example:8888/v1/default/banks/bank-a/stats",
    );
    expect(statsCall[1].headers.authorization).toBe("Bearer k");
    expect(statsCall[1].allowPrivateHosts).toEqual(["hs.example"]);
  });

  it("asks for the bank in the query instead of the default", async () => {
    await start({ url: "https://hs.example", bank: "bank-a" });
    await get("/metrics?bank=bank-b");
    expect(
      fetchMock.mock.calls.some(([u]) => u.endsWith("/banks/bank-b/stats")),
    ).toBe(true);
  });

  it("refuses a bank id that could escape the path", async () => {
    await start({ url: "https://hs.example" });
    const { status } = await get("/metrics?bank=..%2Fadmin");
    expect(status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 409 when the URL is not set", async () => {
    await start({});
    const { status, body } = await get("/metrics");
    expect(status).toBe(409);
    expect(body.error).toBe("not_configured");
  });

  it("reports an unreachable service as down instead of failing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await start({ url: "https://hs.example" });
    const { status, body } = await get("/metrics");
    expect(status).toBe(200);
    expect(body.health.ok).toBe(false);
    expect(body.stats).toBeNull();
  });

  it("flags rejected stats without hiding the service health", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/stats")
        ? json({}, 401)
        : url.endsWith("/health")
          ? json({})
          : json({ api_version: "1", banks: [] }),
    );
    await start({ url: "https://hs.example" });
    const { body } = await get("/metrics");
    expect(body.health.ok).toBe(true);
    expect(body.statsError).toBe(true);
    expect(body.stats).toBeNull();
  });

  it("needs the view permission", async () => {
    await start({ url: "https://hs.example" }, []);
    const { status } = await get("/metrics");
    expect(status).toBeGreaterThanOrEqual(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

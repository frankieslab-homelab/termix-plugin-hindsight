import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";

export class HindsightError extends Error {
  constructor(
    readonly code: "not_configured" | "unreachable" | "rejected",
    message: string,
  ) {
    super(message);
  }
}

export interface BankStats {
  bank_id: string;
  total_nodes: number;
  total_links: number;
  total_documents: number;
  total_observations?: number;
  nodes_by_fact_type?: Record<string, number>;
  links_by_link_type?: Record<string, number>;
  pending_operations: number;
  failed_operations: number;
  operations_by_status?: Record<string, number>;
  pending_consolidation?: number;
  failed_consolidation?: number;
  last_consolidated_at: string | null;
  last_memory_write_at?: string | null;
}

export interface BankSummary {
  bank_id: string;
  name?: string | null;
  fact_count?: number | null;
}

const BANK_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export function isValidBank(bank: unknown): bank is string {
  return typeof bank === "string" && BANK_PATTERN.test(bank);
}

export interface HindsightClient {
  get<T>(path: string): Promise<T>;
  ping(): Promise<{ ok: boolean; latencyMs: number }>;
}

/** Builds a client from the admin settings, or throws not_configured. */
export async function createClient(
  ctx: PluginContext,
): Promise<HindsightClient> {
  const raw = (await ctx.settings.get<string>("url"))?.trim();
  if (!raw) throw new HindsightError("not_configured", "URL is not set");

  let base: URL;
  try {
    base = new URL(raw);
  } catch {
    throw new HindsightError("not_configured", "URL is not valid");
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new HindsightError("not_configured", "URL must be http or https");
  }
  const apiKey = (await ctx.settings.get<string>("apiKey")) ?? "";
  const root = base.toString().replace(/\/+$/, "");

  const request = async (path: string): Promise<Response> => {
    try {
      return await ctx.fetch(`${root}${path}`, {
        headers: {
          accept: "application/json",
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        timeoutMs: 8000,
        // The admin chose this address, and a homelab one is usually private.
        allowPrivateHosts: [base.hostname],
      });
    } catch (error) {
      ctx.log.warn(`Hindsight request failed: ${String(error)}`);
      throw new HindsightError("unreachable", "Hindsight did not answer");
    }
  };

  return {
    async get<T>(path: string): Promise<T> {
      const response = await request(path);
      if (!response.ok) {
        throw new HindsightError(
          "rejected",
          `Hindsight answered ${response.status}`,
        );
      }
      return (await response.json()) as T;
    },
    async ping() {
      const started = Date.now();
      try {
        const response = await request("/health");
        return { ok: response.ok, latencyMs: Date.now() - started };
      } catch {
        return { ok: false, latencyMs: Date.now() - started };
      }
    },
  };
}

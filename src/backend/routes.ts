import type { Request, Response, Router } from "express";
import type { PluginContext } from "@termix-ssh/plugin-sdk/backend";
import {
  createClient,
  HindsightError,
  isValidBank,
  type BankStats,
  type BankSummary,
} from "./hindsight.js";

function fail(res: Response, error: unknown): void {
  if (error instanceof HindsightError) {
    const status = error.code === "not_configured" ? 409 : 502;
    res.status(status).json({ error: error.code });
    return;
  }
  res.status(500).json({ error: "internal" });
}

export function registerRoutes(router: Router, ctx: PluginContext): void {
  router.use(ctx.rbac.require("view") as never);

  /**
   * @openapi
   * /plugin-api/hindsight/metrics:
   *   get:
   *     summary: Health, version and key metrics of a Hindsight memory bank
   *     tags:
   *       - Hindsight
   *     parameters:
   *       - in: query
   *         name: bank
   *         required: false
   *         schema:
   *           type: string
   *         description: Bank id. Defaults to the bank set by the admin.
   *     responses:
   *       200:
   *         description: Health, version, bank stats and the bank list
   *       400:
   *         description: Invalid bank id
   *       409:
   *         description: Hindsight is not configured
   *       502:
   *         description: Hindsight is unreachable or rejected the request
   */
  router.get("/metrics", async (req: Request, res: Response) => {
    try {
      const requested = req.query.bank;
      const bank =
        typeof requested === "string" && requested
          ? requested
          : ((await ctx.settings.get<string>("bank")) ?? "default");
      if (!isValidBank(bank)) {
        return res.status(400).json({ error: "invalid_bank" });
      }

      const client = await createClient(ctx);
      const health = await client.ping();
      if (!health.ok) {
        return res.json({
          bank,
          health,
          version: null,
          stats: null,
          statsError: false,
          banks: [],
        });
      }

      const [version, stats, banks] = await Promise.allSettled([
        client.get<{ api_version: string }>("/version"),
        client.get<BankStats>(
          `/v1/default/banks/${encodeURIComponent(bank)}/stats`,
        ),
        client.get<{ banks: BankSummary[] }>("/v1/default/banks"),
      ]);

      // A rejected key or missing bank must not look like an outage.
      res.json({
        bank,
        health,
        version:
          version.status === "fulfilled" ? version.value.api_version : null,
        stats: stats.status === "fulfilled" ? stats.value : null,
        statsError: stats.status === "rejected",
        banks:
          banks.status === "fulfilled"
            ? banks.value.banks.map((b) => ({
                bank_id: b.bank_id,
                name: b.name ?? null,
                fact_count: b.fact_count ?? null,
              }))
            : [],
      });
    } catch (error) {
      fail(res, error);
    }
  });
}

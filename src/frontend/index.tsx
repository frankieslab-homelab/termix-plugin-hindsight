import { useCallback, useEffect, useState } from "react";
import {
  useTranslation,
  type TabProps,
  type TermixApp,
} from "@termix-ssh/plugin-sdk/frontend";

const TAB_ID = "hindsight";
const REFRESH_MS = 30_000;

interface Stats {
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

interface Metrics {
  bank: string;
  health: { ok: boolean; latencyMs: number };
  version: string | null;
  stats: Stats | null;
  statsError: boolean;
  banks: { bank_id: string; name: string | null }[];
}

function BrainIcon(props: { className?: string }) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M12 5v13" />
    </svg>
  );
}

function formatTime(value: string | null | undefined, never: string): string {
  if (!value) return never;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? never : date.toLocaleString();
}

function Card(props: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="border border-border p-3">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div
        className={`text-xl font-semibold ${props.warn ? "text-destructive" : ""}`}
      >
        {props.value}
      </div>
    </div>
  );
}

function Breakdown(props: { title: string; data?: Record<string, number> }) {
  const entries = Object.entries(props.data ?? {}).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <div className="border border-border p-3">
      <div className="mb-2 text-sm font-medium">{props.title}</div>
      <ul className="flex flex-col gap-1 text-sm">
        {entries.map(([key, count]) => (
          <li key={key} className="flex justify-between">
            <span className="text-muted-foreground">{key}</span>
            <span>{count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function createTab(app: TermixApp) {
  return function HindsightTab({ isVisible }: TabProps) {
    const { t } = useTranslation();
    const [bank, setBank] = useState<string | null>(null);
    const [metrics, setMetrics] = useState<Metrics | null>(null);
    const [problem, setProblem] = useState<"notConfigured" | "error" | null>(
      null,
    );
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

    const load = useCallback(async () => {
      try {
        const { data } = await app.api.get<Metrics>("/metrics", {
          params: bank ? { bank } : undefined,
        });
        setMetrics(data);
        setProblem(null);
        setUpdatedAt(new Date());
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        setProblem(status === 409 ? "notConfigured" : "error");
      }
    }, [bank]);

    useEffect(() => {
      if (!isVisible) return;
      void load();
      const timer = setInterval(() => void load(), REFRESH_MS);
      return () => clearInterval(timer);
    }, [isVisible, load]);

    const stats = metrics?.stats;
    const n = (value: number | undefined) => (value ?? 0).toLocaleString();

    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{t("tab.title")}</h2>
          {metrics && (
            <span
              className={`text-sm ${metrics.health.ok ? "text-green-500" : "text-destructive"}`}
            >
              {metrics.health.ok ? t("tab.status.up") : t("tab.status.down")}
              {metrics.health.ok &&
                ` · ${t("tab.status.latency", { ms: metrics.health.latencyMs })}`}
              {metrics.version &&
                ` · ${t("tab.status.version", { version: metrics.version })}`}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {metrics && metrics.banks.length > 0 && (
              <select
                aria-label={t("tab.bank")}
                className="border border-border bg-transparent px-2 py-1"
                value={metrics.bank}
                onChange={(event) => setBank(event.target.value)}
              >
                {!metrics.banks.some((b) => b.bank_id === metrics.bank) && (
                  <option value={metrics.bank}>{metrics.bank}</option>
                )}
                {metrics.banks.map((b) => (
                  <option key={b.bank_id} value={b.bank_id}>
                    {b.name || b.bank_id}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              className="border border-border px-3 py-1"
              onClick={() => void load()}
            >
              {t("tab.refresh")}
            </button>
          </div>
        </div>

        {problem === "notConfigured" && (
          <p className="text-sm text-muted-foreground">
            {t("tab.notConfigured")}
          </p>
        )}
        {problem === "error" && (
          <p className="text-sm text-destructive">{t("tab.error")}</p>
        )}
        {metrics?.statsError && (
          <p className="text-sm text-destructive">{t("tab.statsError")}</p>
        )}

        {stats ? (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card
                label={t("tab.metrics.memories")}
                value={n(stats.total_nodes)}
              />
              <Card
                label={t("tab.metrics.observations")}
                value={n(stats.total_observations)}
              />
              <Card
                label={t("tab.metrics.documents")}
                value={n(stats.total_documents)}
              />
              <Card
                label={t("tab.metrics.links")}
                value={n(stats.total_links)}
              />
              <Card
                label={t("tab.metrics.pendingConsolidation")}
                value={n(stats.pending_consolidation)}
              />
              <Card
                label={t("tab.metrics.failedConsolidation")}
                value={n(stats.failed_consolidation)}
                warn={(stats.failed_consolidation ?? 0) > 0}
              />
              <Card
                label={t("tab.metrics.pendingOperations")}
                value={n(stats.pending_operations)}
              />
              <Card
                label={t("tab.metrics.failedOperations")}
                value={n(stats.failed_operations)}
                warn={stats.failed_operations > 0}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Breakdown
                title={t("tab.factTypes")}
                data={stats.nodes_by_fact_type}
              />
              <Breakdown
                title={t("tab.linkTypes")}
                data={stats.links_by_link_type}
              />
              <Breakdown
                title={t("tab.operations")}
                data={stats.operations_by_status}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              <div>
                {t("tab.metrics.lastWrite")}:{" "}
                {formatTime(stats.last_memory_write_at, t("tab.never"))}
              </div>
              <div>
                {t("tab.metrics.lastConsolidated")}:{" "}
                {formatTime(stats.last_consolidated_at, t("tab.never"))}
              </div>
            </div>
          </>
        ) : (
          metrics &&
          !metrics.statsError &&
          metrics.health.ok && (
            <p className="text-sm text-muted-foreground">{t("tab.empty")}</p>
          )
        )}

        {updatedAt && (
          <p className="text-xs text-muted-foreground">
            {t("tab.updated", { time: updatedAt.toLocaleTimeString() })}
          </p>
        )}
      </div>
    );
  };
}

export function activate(app: TermixApp): void {
  app.registerRailItem({
    id: TAB_ID,
    icon: BrainIcon,
    titleKey: "tab.title",
    kind: "tab",
    permission: "view",
  });
  app.registerTab(TAB_ID, createTab(app), {
    icon: BrainIcon,
    titleKey: "tab.title",
    singleton: true,
    hostless: true,
  });
}

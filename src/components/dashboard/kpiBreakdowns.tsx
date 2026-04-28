import * as React from "react";
import {
  KpiGroupHeader,
  KpiProjectRow,
  KpiEmptyState,
} from "./KpiDetailDrawer";
import {
  selectCargoValueUsd,
  selectTotalKg,
  selectTotalTons,
  selectStage,
  type RouteStage,
} from "@/lib/selectors/project";
import { selectProjectPL } from "@/lib/selectors/profitLoss";
import { aggregateByCorridor } from "@/lib/selectors/aggregate";
import { toUsd } from "@/lib/finance/fxRates";
import { formatCompactCurrency, formatTons } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

/**
 * Per-KPI breakdown components. Each one receives the active project
 * set and renders inside the KpiDetailDrawer body. Project rows are
 * always clickable via the shared `KpiProjectRow` so navigation
 * behaviour is consistent across the dashboard.
 */

interface BreakdownProps {
  projects: Project[];
  onClose: () => void;
  now?: Date;
}

/* ─────────── Tahmini Gider ─────────── */

export function ExpenseBreakdown({ projects, onClose }: BreakdownProps) {
  const rows = React.useMemo(() => {
    const out: Array<{
      projectNo: string;
      projectName: string;
      vesselName?: string;
      total: number;
      freight: number;
      opex: number;
      other: number;
    }> = [];
    for (const p of projects) {
      const lines = p.costEstimateLines;
      if (!lines || lines.length === 0) continue;
      let freight = 0;
      let opex = 0;
      let other = 0;
      for (const l of lines) {
        if (!l.totalUsd) continue;
        const n = (l.name ?? "").toLowerCase();
        if (n.includes("freight") || n.includes("navlun"))
          freight += l.totalUsd;
        else if (n.includes("opex") || n.includes("operasyonel"))
          opex += l.totalUsd;
        else other += l.totalUsd;
      }
      const total = freight + opex + other;
      if (total <= 0) continue;
      out.push({
        projectNo: p.projectNo,
        projectName: p.projectName,
        vesselName: p.vesselPlan?.vesselName,
        total,
        freight,
        opex,
        other,
      });
    }
    return out.sort((a, b) => b.total - a.total);
  }, [projects]);

  if (rows.length === 0) {
    return <KpiEmptyState message="Gider tahmini olan proje yok" />;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <KpiGroupHeader label="Projeler · giderden büyüğe" count={rows.length} />
      {rows.map((r) => (
        <div key={r.projectNo} className="flex flex-col gap-0.5">
          <KpiProjectRow
            projectNo={r.projectNo}
            projectName={r.projectName}
            vesselName={r.vesselName}
            metric={formatCompactCurrency(r.total, "USD")}
            metricColor="rgb(244 63 94)"
            onClose={onClose}
          />
          <BucketStrip freight={r.freight} opex={r.opex} other={r.other} />
        </div>
      ))}
    </div>
  );
}

function BucketStrip({
  freight,
  opex,
  other,
}: {
  freight: number;
  opex: number;
  other: number;
}) {
  const total = freight + opex + other;
  if (total === 0) return null;
  const seg = (val: number, color: string) =>
    val > 0 ? (
      <span
        className="block h-full"
        style={{ width: `${(val / total) * 100}%`, background: color }}
      />
    ) : null;
  return (
    <div className="ml-12 mr-3 mb-1.5 flex items-center gap-2">
      <div className="flex-1 flex h-1 rounded-full overflow-hidden bg-foreground/[0.06]">
        {seg(freight, "#f97316")}
        {seg(opex, "#a855f7")}
        {seg(other, "#64748b")}
      </div>
      <div className="text-[9.5px] tabular-nums text-muted-foreground/85 flex gap-1.5">
        {freight > 0 && (
          <span style={{ color: "#c2410c" }}>
            F %{((freight / total) * 100).toFixed(0)}
          </span>
        )}
        {opex > 0 && (
          <span style={{ color: "#7e22ce" }}>
            O %{((opex / total) * 100).toFixed(0)}
          </span>
        )}
        {other > 0 && (
          <span style={{ color: "#475569" }}>
            D %{((other / total) * 100).toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────── Aktif Pipeline ─────────── */

const STATUS_COLORS: Record<string, string> = {
  "To Be Nominated": "#8b5cf6",
  Nominated: "#6366f1",
  Commenced: "#f59e0b",
  Completed: "#10b981",
  Closed: "#64748b",
  Cancelled: "#f43f5e",
};

export function PipelineBreakdown({ projects, onClose }: BreakdownProps) {
  const grouped = React.useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      const vs = p.vesselPlan?.vesselStatus;
      if (!vs) continue;
      const arr = m.get(vs) ?? [];
      arr.push(p);
      m.set(vs, arr);
    }
    // Order matches the tile's category order
    const ordered: Array<{ status: string; projects: Project[] }> = [];
    for (const k of Object.keys(STATUS_COLORS)) {
      const arr = m.get(k);
      if (arr && arr.length > 0) ordered.push({ status: k, projects: arr });
    }
    return ordered;
  }, [projects]);

  if (grouped.length === 0) {
    return <KpiEmptyState message="Voyage durumu olan proje yok" />;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {grouped.map((g) => (
        <div key={g.status}>
          <KpiGroupHeader
            label={g.status}
            count={g.projects.length}
            toneColor={STATUS_COLORS[g.status]}
          />
          {g.projects.map((p) => (
            <KpiProjectRow
              key={p.projectNo}
              projectNo={p.projectNo}
              projectName={p.projectName}
              vesselName={p.vesselPlan?.vesselName}
              metric={formatCompactCurrency(selectCargoValueUsd(p), "USD")}
              onClose={onClose}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─────────── Para Birimi Maruziyeti ─────────── */

const CURRENCY_COLORS: Record<string, string> = {
  USD: "#10b981",
  EUR: "#3b82f6",
  TRY: "#f59e0b",
  OTHER: "#94a3b8",
};

export function CurrencyBreakdown({ projects, onClose }: BreakdownProps) {
  const grouped = React.useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      const c = (p.lines[0]?.currency ?? p.currency ?? "OTHER").toUpperCase();
      const key = ["USD", "EUR", "TRY"].includes(c) ? c : "OTHER";
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    return ["USD", "EUR", "TRY", "OTHER"]
      .map((k) => ({ currency: k, projects: m.get(k) ?? [] }))
      .filter((g) => g.projects.length > 0);
  }, [projects]);

  if (grouped.length === 0) {
    return <KpiEmptyState message="Para birimi verisi yok" />;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {grouped.map((g) => (
        <div key={g.currency}>
          <KpiGroupHeader
            label={g.currency}
            count={g.projects.length}
            toneColor={CURRENCY_COLORS[g.currency]}
          />
          {g.projects.map((p) => (
            <KpiProjectRow
              key={p.projectNo}
              projectNo={p.projectNo}
              projectName={p.projectName}
              vesselName={p.vesselPlan?.vesselName}
              metric={formatCompactCurrency(selectCargoValueUsd(p), "USD")}
              onClose={onClose}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─────────── Koridor Konsantrasyonu ─────────── */

export function CorridorBreakdown({ projects, onClose }: BreakdownProps) {
  const corridors = React.useMemo(
    () => aggregateByCorridor(projects),
    [projects]
  );
  const projectsByCorridor = React.useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      const lp = p.vesselPlan?.loadingPort?.name;
      const dp = p.vesselPlan?.dischargePort?.name;
      if (!lp || !dp) continue;
      const key = `${lp}__${dp}`;
      const arr = m.get(key) ?? [];
      arr.push(p);
      m.set(key, arr);
    }
    return m;
  }, [projects]);

  if (corridors.length === 0) {
    return <KpiEmptyState message="Rota verisi olan proje yok" />;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {corridors.slice(0, 12).map((c) => {
        const key = `${c.loadingPort}__${c.dischargePort}`;
        const projs = projectsByCorridor.get(key) ?? [];
        return (
          <div key={key}>
            <KpiGroupHeader
              label={`${c.loadingPort} → ${c.dischargePort}`}
              count={c.count}
              valueChip={
                <span className="text-[10.5px] tabular-nums font-semibold text-foreground/85">
                  {formatCompactCurrency(c.totalCargoValueUsd, "USD")}
                </span>
              }
            />
            {projs.map((p) => (
              <KpiProjectRow
                key={p.projectNo}
                projectNo={p.projectNo}
                projectName={p.projectName}
                vesselName={p.vesselPlan?.vesselName}
                metric={formatCompactCurrency(selectCargoValueUsd(p), "USD")}
                onClose={onClose}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Ortalama Transit ─────────── */

export function VelocityBreakdown({ projects, onClose, now = new Date() }: BreakdownProps) {
  const rows = React.useMemo(() => {
    const out: Array<{
      projectNo: string;
      projectName: string;
      vesselName?: string;
      days: number;
    }> = [];
    for (const p of projects) {
      const ms = p.vesselPlan?.milestones;
      if (!ms) continue;
      const startIso = ms.lpEd ?? ms.blDate ?? null;
      const endIso = ms.dpEta ?? ms.dpNorAccepted ?? null;
      if (!startIso || !endIso) continue;
      const start = new Date(startIso).getTime();
      const end = new Date(endIso).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        continue;
      const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
      out.push({
        projectNo: p.projectNo,
        projectName: p.projectName,
        vesselName: p.vesselPlan?.vesselName,
        days,
      });
    }
    return out.sort((a, b) => b.days - a.days);
  }, [projects]);
  // Suppress unused-var lint when `now` isn't read directly
  void now;

  if (rows.length === 0) {
    return (
      <KpiEmptyState message="LP-ED + DP-ETA tarihleri olan proje yok" />
    );
  }

  const avg = rows.reduce((s, r) => s + r.days, 0) / rows.length;

  return (
    <div className="flex flex-col gap-0.5">
      <KpiGroupHeader
        label={`Ortalama transit · ${Math.round(avg)} gün`}
        count={rows.length}
      />
      {rows.map((r) => (
        <KpiProjectRow
          key={r.projectNo}
          projectNo={r.projectNo}
          projectName={r.projectName}
          vesselName={r.vesselName}
          metric={`${r.days} gün`}
          metricColor={
            r.days > avg * 1.3
              ? "rgb(190 24 93)"
              : r.days < avg * 0.7
                ? "rgb(4 120 87)"
                : undefined
          }
          onClose={onClose}
        />
      ))}
    </div>
  );
}

/* ─────────── Karşı Taraf Dağılımı ─────────── */

export function CounterpartyBreakdown({
  projects,
  onClose,
}: BreakdownProps) {
  const [tab, setTab] = React.useState<"supplier" | "buyer">("supplier");

  const grouped = React.useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      const name = (
        tab === "supplier"
          ? p.vesselPlan?.supplier
          : p.vesselPlan?.buyer
      )?.trim();
      if (!name) continue;
      const arr = m.get(name) ?? [];
      arr.push(p);
      m.set(name, arr);
    }
    return [...m.entries()]
      .map(([name, projs]) => ({ name, projects: projs }))
      .sort((a, b) => b.projects.length - a.projects.length);
  }, [projects, tab]);

  return (
    <div className="flex flex-col gap-2">
      <div className="px-2 flex gap-1.5">
        {(["supplier", "buyer"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="text-[11.5px] font-semibold px-3 py-1 rounded-full border transition-colors"
            style={
              tab === t
                ? {
                    backgroundColor: "var(--filter-active-bg)",
                    color: "var(--filter-active-fg)",
                    borderColor: "var(--filter-active-border)",
                  }
                : { borderColor: "rgba(15,23,42,0.15)", color: "rgb(71 85 105)" }
            }
          >
            {t === "supplier" ? "Tedarikçi" : "Alıcı"}
          </button>
        ))}
      </div>
      {grouped.length === 0 ? (
        <KpiEmptyState message={`${tab === "supplier" ? "Tedarikçi" : "Alıcı"} verisi yok`} />
      ) : (
        grouped.map((g) => (
          <div key={g.name}>
            <KpiGroupHeader label={g.name} count={g.projects.length} />
            {g.projects.map((p) => (
              <KpiProjectRow
                key={p.projectNo}
                projectNo={p.projectNo}
                projectName={p.projectName}
                vesselName={p.vesselPlan?.vesselName}
                metric={formatCompactCurrency(selectCargoValueUsd(p), "USD")}
                onClose={onClose}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/* ─────────── Period Performance ─────────── */

export function PeriodPerformanceBreakdown({
  projects,
  onClose,
}: BreakdownProps) {
  const rows = React.useMemo(() => {
    return projects
      .map((p) => ({
        p,
        cargo: selectCargoValueUsd(p),
      }))
      .sort((a, b) => b.cargo - a.cargo);
  }, [projects]);

  if (rows.length === 0) return <KpiEmptyState message="Proje yok" />;

  return (
    <div className="flex flex-col gap-0.5">
      <KpiGroupHeader
        label="Tüm projeler · kargo değerine göre"
        count={rows.length}
      />
      {rows.map(({ p, cargo }) => (
        <KpiProjectRow
          key={p.projectNo}
          projectNo={p.projectNo}
          projectName={p.projectName}
          vesselName={p.vesselPlan?.vesselName}
          metric={formatCompactCurrency(cargo, "USD")}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

/* ─────────── Estimated P&L ─────────── */

export function EstimatedPLBreakdown({ projects, onClose }: BreakdownProps) {
  const rows = React.useMemo(() => {
    return projects
      .map((p) => {
        const pl = selectProjectPL(p);
        const cur = (pl.currency ?? "USD").toUpperCase();
        return {
          p,
          plUsd: pl.salesTotal > 0 ? toUsd(pl.pl, cur) : 0,
          marginPct: pl.marginPct,
          salesUsd: toUsd(pl.salesTotal, cur),
          purchaseUsd: toUsd(pl.purchaseTotal, cur),
          expenseUsd: pl.expenseTotal,
        };
      })
      .filter((r) => r.salesUsd > 0)
      .sort((a, b) => b.plUsd - a.plUsd);
  }, [projects]);

  if (rows.length === 0)
    return <KpiEmptyState message="K&Z hesaplanabilir proje yok" />;

  return (
    <div className="flex flex-col gap-0.5">
      <KpiGroupHeader
        label="Projeler · K&Z'ye göre (yüksekten düşüğe)"
        count={rows.length}
      />
      {rows.map(({ p, plUsd, marginPct }) => {
        const sign = plUsd >= 0 ? "+" : "−";
        return (
          <KpiProjectRow
            key={p.projectNo}
            projectNo={p.projectNo}
            projectName={p.projectName}
            vesselName={p.vesselPlan?.vesselName}
            metric={`${sign}${formatCompactCurrency(Math.abs(plUsd), "USD")}${
              marginPct != null ? ` · %${marginPct.toFixed(1)}` : ""
            }`}
            metricColor={
              plUsd > 0
                ? "rgb(4 120 87)"
                : plUsd < 0
                  ? "rgb(190 24 93)"
                  : undefined
            }
            onClose={onClose}
          />
        );
      })}
    </div>
  );
}

/* ─────────── Tahmini Miktar ─────────── */

export function QuantityBreakdown({ projects, onClose }: BreakdownProps) {
  const rows = React.useMemo(() => {
    return projects
      .map((p) => {
        const tons = selectTotalTons(p);
        const product =
          p.lines.find((l) => l.productName?.trim())?.productName ?? "";
        return { p, tons, product };
      })
      .filter((r) => r.tons > 0)
      .sort((a, b) => b.tons - a.tons);
  }, [projects]);

  if (rows.length === 0) return <KpiEmptyState message="Tonaj verisi yok" />;

  return (
    <div className="flex flex-col gap-0.5">
      <KpiGroupHeader
        label="Projeler · tonaja göre"
        count={rows.length}
        valueChip={
          <span className="text-[10.5px] tabular-nums font-semibold text-amber-700">
            {formatTons(
              rows.reduce((s, r) => s + selectTotalKg(r.p), 0)
            )}
          </span>
        }
      />
      {rows.map(({ p, tons, product }) => (
        <KpiProjectRow
          key={p.projectNo}
          projectNo={p.projectNo}
          projectName={product || p.projectName}
          vesselName={p.vesselPlan?.vesselName}
          metric={
            tons >= 1000
              ? `${(tons / 1000).toFixed(1)} bin t`
              : `${tons.toFixed(0)} t`
          }
          metricColor="rgb(180 83 9)"
          onClose={onClose}
        />
      ))}
    </div>
  );
}

/** Voyage stage helper kept here so the imports tree stays in one
 *  place; not currently used by a breakdown but available if a new
 *  KPI wants to group by stage. */
export function projectsByStage(
  projects: Project[],
  now: Date
): Map<RouteStage | "unscheduled", Project[]> {
  const m = new Map<RouteStage | "unscheduled", Project[]>();
  for (const p of projects) {
    const stage = selectStage(p, now) ?? "unscheduled";
    const arr = m.get(stage) ?? [];
    arr.push(p);
    m.set(stage, arr);
  }
  return m;
}

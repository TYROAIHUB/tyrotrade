import { motion, useReducedMotion } from "framer-motion";
import { ContainerIcon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import type { Project } from "@/lib/dataverse/entities";

interface ActivePipelineTileProps {
  projects: Project[];
  now?: Date;
  span?: string;
  rowSpan?: string;
}

/**
 * Active project status breakdown. Categories mirror the F&O voyage-status
 * option-set (`mserp_voyagestatus`) verbatim, so the tile speaks the same
 * language as the rest of the app:
 *   - "To Be Nominated" / "Nominated"  — pre-loading
 *   - "Commenced"                      — voyage in progress
 *   - "Completed" / "Closed"           — terminal (delivered / paid)
 *   - "Cancelled"                      — terminal (cancelled)
 *
 * Project-level "Açık" / "Kapalı" fallback kicks in when the ship row has
 * no recognised voyage status (no ship plan attached).
 */
// Labels mirror the raw F&O `mserp_voyagestatus` option-set values verbatim
// — "Commenced", "Completed", etc. The user reads the same vocabulary in
// F&O and on the dashboard; no translation drift.
const STATUS_CATEGORIES = [
  { key: "To Be Nominated", label: "To Be Nominated", color: "#8b5cf6" },
  { key: "Nominated", label: "Nominated", color: "#6366f1" },
  { key: "Commenced", label: "Commenced", color: "#f59e0b" },
  { key: "Completed", label: "Completed", color: "#10b981" },
  { key: "Closed", label: "Closed", color: "#64748b" },
  { key: "Cancelled", label: "Cancelled", color: "#f43f5e" },
  // Project-level fallbacks (no ship plan) — these are stored in Turkish at
  // the F&O project header level so they stay Turkish.
  { key: "Açık", label: "Açık", color: "#0ea5e9" },
  { key: "Kapalı", label: "Kapalı", color: "#94a3b8" },
] as const;

export function ActivePipelineTile({
  projects,
  span,
  rowSpan,
}: ActivePipelineTileProps) {
  const reduceMotion = useReducedMotion();

  const counts: Record<string, number> = Object.fromEntries(
    STATUS_CATEGORIES.map((c) => [c.key, 0])
  );
  for (const p of projects) {
    const status = p.vesselPlan?.vesselStatus ?? p.status;
    if (status in counts) counts[status]++;
    else counts[status] = (counts[status] ?? 0) + 1;
  }
  const total = projects.length;
  const sumStages = STATUS_CATEGORIES.reduce(
    (acc, s) => acc + (counts[s.key] ?? 0),
    0
  );

  return (
    <BentoTile
      title="Aktif Pipeline"
      subtitle="Tüm operasyonel projeler"
      icon={ContainerIcon}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-3 h-full">
        <div className="flex items-baseline gap-3">
          <span className="text-[40px] font-semibold leading-none tracking-tight">
            <AnimatedNumber value={total} preset="count" />
          </span>
          <span className="text-[11px] text-muted-foreground">
            proje takipte
          </span>
        </div>

        {/* Stacked status bar */}
        <div className="flex flex-col gap-2 mt-auto">
          <div
            className="relative h-2.5 w-full rounded-full overflow-hidden"
            style={{
              background: "rgba(15,23,42,0.06)",
              boxShadow:
                "inset 0 1px 1px 0 rgba(15,23,42,0.08), inset 0 -1px 0 0 rgba(255,255,255,0.6)",
            }}
            role="progressbar"
            aria-label="Pipeline durum dağılımı"
          >
            {sumStages > 0 &&
              STATUS_CATEGORIES.map((s, i) => {
                const value = counts[s.key] ?? 0;
                const pct = (value / sumStages) * 100;
                const offsetPct = STATUS_CATEGORIES.slice(0, i).reduce(
                  (acc, prev) =>
                    acc + ((counts[prev.key] ?? 0) / sumStages) * 100,
                  0
                );
                return (
                  <motion.div
                    key={s.key}
                    initial={
                      reduceMotion ? { width: `${pct}%` } : { width: 0 }
                    }
                    animate={{ width: `${pct}%` }}
                    transition={{
                      duration: 0.7,
                      delay: 0.1 + i * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute top-0 h-full"
                    style={{
                      left: `${offsetPct}%`,
                      background: `linear-gradient(180deg, ${s.color} 0%, ${s.color} 55%, color-mix(in oklab, ${s.color} 75%, black 25%) 100%)`,
                      boxShadow:
                        "inset 0 1px 0 0 rgba(255,255,255,0.4), inset 0 -1px 0 0 rgba(0,0,0,0.08)",
                    }}
                  />
                );
              })}
          </div>

          <div className="flex items-center justify-between gap-2 text-[10.5px] flex-wrap">
            {STATUS_CATEGORIES.map((s) => (
              <div
                key={s.key}
                className="flex items-center gap-1.5 min-w-0 truncate"
              >
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="text-muted-foreground truncate">
                  {s.label}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {counts[s.key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BentoTile>
  );
}

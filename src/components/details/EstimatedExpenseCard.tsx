import { Receipt } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_EXPENSE } from "./AccentIconBadge";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

/**
 * Per-line breakdown of estimated expenses for a project.
 *
 * Each row shows:
 *   <expense name>     <unitPrice $/MT>  ×  <project tons>  =  <total $>
 *
 * Subtotal = sum of all line totals. Source data is the project's
 * `mserp_tryaiotherexpenseentities` rows, with `mserp_expamountusdd`
 * treated as a per-metric-ton USD rate (multiplied by project tonnage in the
 * composer to produce `costEstimateLines[i].totalUsd`).
 */
export function EstimatedExpenseCard({ project }: Props) {
  const lines = project.costEstimateLines ?? [];
  if (lines.length === 0) return null;

  const subtotal = lines.reduce((sum, l) => sum + l.totalUsd, 0);
  // Tonnage is the same for every line (multiplier from project), so just
  // grab from the first one.
  const tons = lines[0]?.tons ?? 0;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <AccentIconBadge size="sm" tone={TONE_EXPENSE}>
            <Receipt className="size-4" strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Tahmini Gider
            </div>
            <div className="text-sm font-semibold">
              {lines.length} kalem
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 px-3 py-1.5 bg-foreground/[0.03] text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            <div>Gider</div>
            <div className="text-right tabular-nums">$ / MT</div>
            <div className="text-right tabular-nums">Toplam</div>
          </div>
          {lines.map((l, i) => (
            <div
              key={`${l.name}-${i}`}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 px-3 py-2 text-[11.5px] border-t border-border/30 first:border-t-0 items-baseline"
            >
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">{l.name}</div>
                {l.description && (
                  <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                    {l.description}
                  </div>
                )}
              </div>
              <div className="text-right tabular-nums text-muted-foreground">
                {formatCurrency(l.unitPriceUsd, "USD", { maximumFractionDigits: 2 })}
              </div>
              <div className="text-right tabular-nums font-semibold text-foreground">
                {formatCurrency(l.totalUsd, "USD")}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 px-3 py-2.5 bg-foreground/[0.04] text-[12px] border-t border-border/40 items-baseline">
            <div className="font-semibold uppercase tracking-wider text-[10.5px] text-muted-foreground">
              Alt Toplam
            </div>
            <div className="text-right tabular-nums text-muted-foreground/80">
              {formatNumber(tons, 0)} t
            </div>
            <div className="text-right tabular-nums font-bold text-foreground">
              {formatCurrency(subtotal, "USD")}
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

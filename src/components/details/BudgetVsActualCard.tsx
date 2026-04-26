import { TrendingUp, Target } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

/**
 * Segment Bütçe & Faturalı Satış card.
 *
 * Pulls together three pieces of data the composer attached to the project:
 *  - `project.segment` — the project's segment (e.g. "International")
 *  - `project.segmentBudgets` — the segment's annual sales budget rows
 *    aggregated from `mserp_tryaiprojectbudgetlineentities` (sum of
 *    `mserp_amount` per year for THE WHOLE segment, not just this project)
 *  - `project.salesActualUsd` / `salesActualByCurrency` — invoiced totals
 *    for THIS project from the per-project aggregation
 *
 * Shown so the user can see "this project is X% of segment's annual sales
 * target" — a common operational question for budget realisation.
 */
export function BudgetVsActualCard({ project }: Props) {
  const segment = project.segment;
  const budgets = project.segmentBudgets ?? [];
  const actualUsd = project.salesActualUsd ?? 0;
  const byCur = project.salesActualByCurrency ?? {};
  const invoiceCount = project.salesActualInvoiceCount ?? 0;

  // Hide entirely when there's nothing meaningful to show — keeps the right
  // rail tidy for projects with no segment AND no invoicing yet.
  if (!segment && actualUsd === 0 && budgets.length === 0) return null;

  // Pick the most recent year that has a budget. If no budget at all but
  // invoices exist, default to "current year" so the section still renders.
  const currentYear = new Date().getFullYear();
  const latestBudgetYear =
    budgets.length > 0 ? budgets[0].year : currentYear;
  const focusBudget =
    budgets.find((b) => b.year === currentYear) ??
    budgets[0] ??
    null;

  const segmentTotalBudgetUsd = focusBudget?.totalAmount ?? 0;
  const projectShareOfBudget =
    segmentTotalBudgetUsd > 0
      ? (actualUsd / segmentTotalBudgetUsd) * 100
      : null;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-8 rounded-xl bg-sky-500/15 text-sky-700 grid place-items-center">
            <Target className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Segment Bütçe & Faturalı Satış
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {segment ? (
                <>
                  <span>{segment}</span>
                  <span className="text-muted-foreground/60 text-[11px]">
                    · {focusBudget ? focusBudget.year : "—"}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">Segment yok</span>
              )}
            </div>
          </div>
        </div>

        {/* Top-line stat grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Stat
            label="Segment Bütçesi"
            value={
              focusBudget
                ? formatCurrency(focusBudget.totalAmount, "USD")
                : "—"
            }
            sub={
              focusBudget
                ? `${formatNumber(focusBudget.totalQty / 1000, 0)} t hedef`
                : "Bu segment için bütçe yok"
            }
            tone="muted"
          />
          <Stat
            label="Bu Proje · Faturalı Satış"
            value={formatCurrency(actualUsd, "USD")}
            sub={
              invoiceCount > 0
                ? `${invoiceCount} fatura satırı`
                : "Henüz fatura yok"
            }
            tone={actualUsd > 0 ? "positive" : "muted"}
          />
        </div>

        {/* Project's share of segment budget */}
        {projectShareOfBudget != null && projectShareOfBudget > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-muted-foreground">
                Bu projenin segment bütçesindeki payı
              </span>
              <span className="font-semibold tabular-nums">
                %{projectShareOfBudget.toFixed(1)}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 to-sky-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, projectShareOfBudget)}%` }}
              />
            </div>
          </div>
        )}

        {/* Multi-currency breakdown when applicable */}
        {Object.keys(byCur).filter((c) => byCur[c] > 0).length > 1 && (
          <div className="mb-3 px-2.5 py-2 rounded-xl bg-foreground/[0.025] border border-border/40">
            <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground mb-1">
              Para Birimi Dağılımı
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {Object.entries(byCur)
                .filter(([, v]) => v > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([cur, amount]) => (
                  <span
                    key={cur}
                    className="text-[11px] tabular-nums"
                  >
                    <span className="text-muted-foreground">{cur}</span>{" "}
                    <span className="font-semibold">
                      {formatCurrency(amount, cur)}
                    </span>
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* Multi-year segment budget timeline */}
        {budgets.length > 1 && (
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              <TrendingUp className="size-3" />
              Yıl Bazında Segment Bütçesi
            </div>
            <div className="flex items-end gap-1.5 h-16">
              {(() => {
                const max = Math.max(
                  ...budgets.map((b) => b.totalAmount),
                  1
                );
                return budgets
                  .slice()
                  .sort((a, b) => a.year - b.year)
                  .map((b) => {
                    const pct = (b.totalAmount / max) * 100;
                    const isLatest = b.year === latestBudgetYear;
                    return (
                      <div
                        key={b.year}
                        className="flex-1 flex flex-col items-center gap-1 min-w-0"
                        title={`${b.year} · ${formatCurrency(b.totalAmount, "USD")} · ${formatNumber(b.totalQty / 1000, 0)} t`}
                      >
                        <div
                          className={cn(
                            "w-full rounded-t-md transition-all",
                            isLatest
                              ? "bg-gradient-to-t from-sky-600 to-sky-400"
                              : "bg-muted/80"
                          )}
                          style={{ height: `${Math.max(8, pct)}%` }}
                        />
                        <div
                          className={cn(
                            "text-[9.5px] tabular-nums",
                            isLatest
                              ? "text-foreground font-semibold"
                              : "text-muted-foreground"
                          )}
                        >
                          {b.year}
                        </div>
                      </div>
                    );
                  });
              })()}
            </div>
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "positive" | "muted";
}) {
  return (
    <div
      className={cn(
        "px-2.5 py-2 rounded-xl border",
        tone === "positive"
          ? "bg-emerald-500/8 border-emerald-500/20"
          : "bg-card/50 border-border/40"
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-semibold mt-0.5 tabular-nums",
          tone === "positive" && "text-emerald-700"
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
      )}
    </div>
  );
}

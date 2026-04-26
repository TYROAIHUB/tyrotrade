import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatCompactCurrency } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

export function BudgetPLCard({ project }: Props) {
  const budget = project.costEstimate;
  const actual = project.actualCost;
  if (!budget || !actual) return null;

  const totalBudget = budget.totalUsd;
  const totalActual = actual.bookedUsd;
  const variance = totalBudget - totalActual;
  const variancePct = totalBudget > 0 ? (variance / totalBudget) * 100 : 0;
  const positive = variance >= 0;

  const items: Array<{ label: string; value: number }> = [
    { label: "Navlun", value: budget.freightUsd },
    { label: "Sigorta", value: budget.insuranceUsd },
    { label: "Gümrük", value: budget.dutiesUsd },
    { label: "Diğer", value: budget.otherUsd },
  ];

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-8 rounded-xl bg-primary/12 text-primary grid place-items-center">
            <Wallet className="size-4" />
          </div>
          <h3 className="text-sm font-semibold">Bütçe & Gerçekleşen (PL)</h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="px-3 py-2.5 rounded-xl bg-card/50 border border-border/40">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Bütçe
            </div>
            <div className="text-base font-semibold mt-0.5">
              {formatCompactCurrency(totalBudget, "USD")}
            </div>
          </div>
          <div className="px-3 py-2.5 rounded-xl bg-card/50 border border-border/40">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Gerçekleşen
            </div>
            <div className="text-base font-semibold mt-0.5">
              {formatCompactCurrency(totalActual, "USD")}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-xl border mb-3",
            positive
              ? "bg-emerald-500/8 border-emerald-500/20 text-emerald-700"
              : "bg-rose-500/8 border-rose-500/20 text-rose-700"
          )}
        >
          {positive ? (
            <TrendingUp className="size-4" />
          ) : (
            <TrendingDown className="size-4" />
          )}
          <div className="text-xs">
            <span className="font-medium">
              {positive ? "Bütçe altında" : "Bütçe aşımı"}
            </span>
            <span className="text-muted-foreground ml-2">
              {formatCompactCurrency(Math.abs(variance), "USD")} (%
              {Math.abs(variancePct).toFixed(1)})
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          {items.map((it) => {
            const pct = totalBudget > 0 ? (it.value / totalBudget) * 100 : 0;
            return (
              <div key={it.label} className="text-[11px]">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-muted-foreground">{it.label}</span>
                  <span className="font-medium">
                    {formatCompactCurrency(it.value, "USD")}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full bg-primary/70 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
          <Mini label="Bookd" value={actual.bookedUsd} />
          <Mini label="Faturalı" value={actual.invoicedUsd} />
          <Mini label="Ödenen" value={actual.paidUsd} />
        </div>
      </div>
    </GlassPanel>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center px-2 py-1.5 rounded-lg bg-card/40 border border-border/40">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-semibold mt-0.5">
        {formatCompactCurrency(value, "USD")}
      </div>
    </div>
  );
}

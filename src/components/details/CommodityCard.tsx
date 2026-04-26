import { Wheat } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { formatCurrency, formatNumber, formatTons } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

export function CommodityCard({ project }: Props) {
  const totalKg = project.lines.reduce((s, l) => s + l.quantityKg, 0);
  const totalValue =
    project.vesselPlan?.cargoValueUsd ??
    project.lines.reduce((s, l) => s + (l.quantityKg / 1000) * l.unitPrice, 0);
  const planned = project.vesselPlan?.voyageTotalTonnage ?? 0;
  const actual = project.vesselPlan?.actualQuantity ?? 0;
  const loadPct = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="size-8 rounded-xl bg-amber-500/15 text-amber-700 grid place-items-center">
            <Wheat className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Taşınan Ürün
            </div>
            <div className="text-sm font-semibold truncate">
              {project.vesselPlan?.cargoProduct ??
                project.lines[0]?.productName ??
                "—"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Stat
            label="Toplam Tonaj"
            value={`${formatTons(totalKg)} t`}
            sub={`${formatNumber(totalKg)} KG`}
          />
          <Stat
            label="Ürün Bedeli"
            value={formatCurrency(totalValue, project.currency)}
            sub={`Birim ${formatCurrency(
              project.lines[0]?.unitPrice ?? 0,
              project.currency
            )} / t`}
          />
        </div>

        {planned > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-muted-foreground">Yükleme İlerlemesi</span>
              <span className="font-medium">
                {formatNumber(actual, 0)} / {formatNumber(planned, 0)} t
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-[oklch(58%_0.18_245)] to-[oklch(68%_0.13_205)] rounded-full transition-all duration-500"
                style={{ width: `${loadPct}%` }}
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 text-right">
              %{loadPct.toFixed(1)}
            </div>
          </div>
        )}

      </div>
    </GlassPanel>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-2.5 py-2 rounded-xl bg-card/50 border border-border/40">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

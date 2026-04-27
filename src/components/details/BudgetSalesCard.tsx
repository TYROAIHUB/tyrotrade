import * as React from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChartLineData01Icon } from "@hugeicons/core-free-icons";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge } from "./AccentIconBadge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useProjectInvoices } from "@/hooks/useProjectInvoices";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

const TR_MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

interface PeriodRow {
  /** Calendar key e.g. "2026-04" */
  key: string;
  year: number;
  month: number;
  /** Segment budget for this month (USD) — 0 if none defined. */
  budgetUsd: number;
  /** Sum of THIS project's invoices in this month, USD only. */
  salesUsd: number;
  /** Number of invoice rows in this month for this project. */
  invoiceCount: number;
}

/**
 * "Gerçekleşen Satış Segment Bütçesi" — segment budget × invoiced sales card.
 *
 * For each month this project has invoices in, surfaces:
 *   - Segment-level budget for that month (USD)
 *   - This project's invoiced total for the same month (USD)
 *   - Per-month ratio (Pay column)
 *
 * Footer row totals the matched periods plus an aggregate progress bar
 * showing "this project's share of segment budget for the months it
 * billed in". Color encodes performance against target (rose < 50% <
 * amber < 80% < sky < 100% < emerald).
 *
 * Auto-fetches per-project invoices via `useProjectInvoices`.
 */
export function BudgetSalesCard({ project }: Props) {
  const { invoices, isFetching } = useProjectInvoices(project.projectNo);
  // Detail rows hidden by default — operators get the totals at a
  // glance and can drill into per-month rows on demand.
  const [open, setOpen] = React.useState(false);

  // Group THIS project's invoices by year-month (USD only — budget is USD).
  const salesByMonth = React.useMemo<
    Map<string, { sales: number; count: number }>
  >(() => {
    const m = new Map<string, { sales: number; count: number }>();
    for (const inv of invoices) {
      const cur = (inv["mserp_currencycode"] as string) ?? "";
      if (cur !== "USD") continue;
      const dateRaw = inv["mserp_invoicedate"] as string | undefined;
      if (!dateRaw) continue;
      const match = dateRaw.match(/^(\d{4})-(\d{2})/);
      if (!match) continue;
      const key = `${match[1]}-${match[2]}`;
      const amount = Number(inv["mserp_lineamount"]);
      if (!Number.isFinite(amount)) continue;
      let entry = m.get(key);
      if (!entry) {
        entry = { sales: 0, count: 0 };
        m.set(key, entry);
      }
      entry.sales += amount;
      entry.count += 1;
    }
    return m;
  }, [invoices]);

  // Build PeriodRow array — one row per month that has invoices.
  const monthBudgets = project.segmentBudgetsByMonth ?? [];
  const monthBudgetByKey = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const b of monthBudgets)
      m.set(`${b.year}-${String(b.month).padStart(2, "0")}`, b.totalAmount);
    return m;
  }, [monthBudgets]);

  const periods: PeriodRow[] = React.useMemo(() => {
    const rows: PeriodRow[] = [];
    for (const [key, { sales, count }] of salesByMonth.entries()) {
      const [yStr, mStr] = key.split("-");
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10);
      rows.push({
        key,
        year,
        month,
        budgetUsd: monthBudgetByKey.get(key) ?? 0,
        salesUsd: Math.round(sales),
        invoiceCount: count,
      });
    }
    return rows.sort(
      (a, b) => b.year * 100 + b.month - (a.year * 100 + a.month)
    );
  }, [salesByMonth, monthBudgetByKey]);

  // Totals across the periods we bill in
  const totalBudget = periods.reduce((s, p) => s + p.budgetUsd, 0);
  const totalSales = periods.reduce((s, p) => s + p.salesUsd, 0);
  const totalRatio =
    totalBudget > 0 ? (totalSales / totalBudget) * 100 : null;

  const segment = project.segment;
  const hasInvoiceData = invoices.length > 0;

  // Render nothing when the project has no invoices — keeps the right
  // panel terse for projects that haven't billed yet. The fetching
  // window is short, so flickering during refetch is unlikely.
  if (!isFetching && !hasInvoiceData) return null;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        {/* Header — accent icon badge + title + segment chip + spinner +
            detail toggle. Title block becomes the toggle so the whole
            top of the card is a comfortable click target. */}
        <button
          type="button"
          onClick={() =>
            periods.length > 0 ? setOpen((v) => !v) : undefined
          }
          aria-expanded={open}
          disabled={periods.length === 0}
          className={
            "w-full flex items-center gap-2.5 mb-3 text-left transition-colors " +
            (periods.length > 0
              ? "cursor-pointer hover:opacity-90"
              : "cursor-default")
          }
        >
          <AccentIconBadge size="sm">
            <HugeiconsIcon
              icon={ChartLineData01Icon}
              size={16}
              strokeWidth={2}
            />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Gerçekleşen Satış Segment Bütçesi
            </div>
            <div className="text-[13px] font-semibold leading-snug flex items-center gap-1.5 flex-wrap">
              <span>Realized Sales</span>
              {segment && (
                <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-foreground/[0.04] text-foreground/80 font-normal">
                  {segment}
                </code>
              )}
            </div>
          </div>
          {isFetching && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground shrink-0" />
          )}
          {periods.length > 0 && (
            <ChevronDown
              className={
                "size-4 shrink-0 text-muted-foreground transition-transform " +
                (open ? "rotate-180" : "")
              }
            />
          )}
        </button>

        {periods.length > 0 && (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            {open && (
              <>
                {/* Detail header row — visible only when the user opted
                    into per-month breakdown. */}
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_56px] gap-x-3 px-3 py-1.5 bg-foreground/[0.03] text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <div>Dönem</div>
                  <div className="text-right">Bütçe (USD)</div>
                  <div className="text-right">Faturalı Satış (USD)</div>
                  <div className="text-right">Pay</div>
                </div>
                {periods.map((p) => {
                  const ratio =
                    p.budgetUsd > 0 ? (p.salesUsd / p.budgetUsd) * 100 : null;
                  return (
                    <PeriodRowView
                      key={p.key}
                      label={`${TR_MONTHS[p.month - 1]} ${p.year}`}
                      sub={`${p.invoiceCount} fatura`}
                      budgetUsd={p.budgetUsd}
                      salesUsd={p.salesUsd}
                      ratio={ratio}
                    />
                  );
                })}
              </>
            )}
            {/* Footer total row — always visible (the at-a-glance summary). */}
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_56px] gap-x-3 px-3 py-2.5 bg-foreground/[0.04] items-baseline">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
                Toplam
              </div>
              <div className="text-right tabular-nums font-semibold text-[12px] text-foreground/85">
                {formatCurrency(totalBudget, "USD")}
              </div>
              <div className="text-right tabular-nums font-bold text-[12.5px] text-foreground">
                {formatCurrency(totalSales, "USD")}
              </div>
              <div className="text-right tabular-nums text-[11px] text-muted-foreground">
                {totalRatio != null ? `%${totalRatio.toFixed(1)}` : "—"}
              </div>
            </div>
            {/* Aggregate progress bar — color tracks performance vs target */}
            {totalRatio != null && (
              <div className="px-3 pt-3 pb-2.5 border-t border-border/40">
                <ProgressWithScale ratio={totalRatio} />
              </div>
            )}
          </div>
        )}

        {hasInvoiceData && periods.length === 0 && (
          <div className="text-[11.5px] text-muted-foreground italic px-2 py-3">
            Bu projedeki USD-bazlı faturalar yok ya da tarih bilgisi eksik
          </div>
        )}
      </div>
    </GlassPanel>
  );
}

/* ─────────── Helpers ─────────── */

type ProgressTone = "rose" | "amber" | "sky" | "emerald";

function progressTone(ratio: number): ProgressTone {
  if (ratio >= 100) return "emerald";
  if (ratio >= 80) return "sky";
  if (ratio >= 50) return "amber";
  return "rose";
}

const TONE_BAR: Record<ProgressTone, string> = {
  rose: "bg-gradient-to-r from-rose-600 to-rose-400",
  amber: "bg-gradient-to-r from-amber-600 to-amber-400",
  sky: "bg-gradient-to-r from-sky-600 to-sky-400",
  emerald: "bg-gradient-to-r from-emerald-500 to-emerald-400",
};

const TONE_CHIP: Record<ProgressTone, string> = {
  rose: "bg-rose-500/15 text-rose-700",
  amber: "bg-amber-500/15 text-amber-700",
  sky: "bg-sky-500/15 text-sky-700",
  emerald: "bg-emerald-500/15 text-emerald-700",
};

function ProgressWithScale({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(100, ratio));
  const tone = progressTone(ratio);
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex-1 h-2.5 rounded-full bg-foreground/[0.08] ring-1 ring-foreground/10 overflow-hidden"
        style={{ boxShadow: "inset 0 1px 2px 0 rgba(15,23,42,0.08)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio)}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            TONE_BAR[tone]
          )}
          style={{
            width: `${clamped}%`,
            boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.35)",
          }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-sm",
          TONE_CHIP[tone]
        )}
      >
        %{ratio.toFixed(1)}
      </span>
    </div>
  );
}

function PeriodRowView({
  label,
  sub,
  budgetUsd,
  salesUsd,
  ratio,
}: {
  label: string;
  sub?: string;
  budgetUsd: number;
  salesUsd: number;
  ratio: number | null;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_56px] gap-x-3 px-3 py-2 text-[11.5px] border-t border-border/30 first:border-t-0 items-baseline">
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate">{label}</div>
        {sub && (
          <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
            {sub}
          </div>
        )}
      </div>
      <div className="text-right tabular-nums text-muted-foreground">
        {budgetUsd > 0 ? formatCurrency(budgetUsd, "USD") : "—"}
      </div>
      <div className="text-right tabular-nums font-semibold text-foreground">
        {formatCurrency(salesUsd, "USD")}
      </div>
      <div className="text-right tabular-nums text-[10.5px] text-muted-foreground">
        {ratio != null ? `%${ratio.toFixed(0)}` : "—"}
      </div>
    </div>
  );
}

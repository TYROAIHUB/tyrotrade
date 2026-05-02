import * as React from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
} from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_PL } from "./AccentIconBadge";
import { formatCurrency } from "@/lib/format";
import {
  selectSalesTotal,
  selectPurchaseTotal,
} from "@/lib/selectors/profitLoss";
import { toUsdAtDate } from "@/lib/finance/fxRates";
import { readCache } from "@/lib/storage/entityCache";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

const PURCHASE_ENTITY_SET = "mserp_tryaivendinvoicetransentities";

/**
 * "Realized P&L" — sales × purchase, both estimated and realized,
 * for the selected project.
 *
 *   Tahmini Satış  =  Σ (line.quantityKg / 1000) × line.unitPrice
 *                     (line currency, FX-converted to USD at the
 *                     project date for comparison with realized USD)
 *   Gerçekleşen Satış  =  project.salesActualUsd  (already USD,
 *                         normalised by composer from the per-project
 *                         sales aggregate)
 *   Tahmini Alım   =  Σ (line.quantityKg / 1000) × line.purchasePrice
 *                     (same FX treatment as Tahmini Satış)
 *   Gerçekleşen Alım  =  Σ rows from
 *                        `mserp_tryaivendinvoicetransentities` (the
 *                        cached Proje Satınalma Satırları) for the
 *                        project, FX-converted at each row's
 *                        `mserp_invoicedate`.
 *
 * Bottom totals (always visible):
 *   Tahmini K&Z     = Tahmini Satış − Tahmini Alım
 *   Gerçekleşen K&Z = Gerçekleşen Satış − Gerçekleşen Alım
 *
 * Tone of the realized total drives the card's icon + value colour:
 *   profit (positive)   → emerald
 *   loss   (negative)   → rose
 *   on-target / no data → slate
 *
 * Hides itself entirely when every side is zero — keeps the right
 * rail clean for projects that haven't priced or invoiced yet.
 */
export function BudgetSalesCard({ project }: Props) {
  const lineCurrency = project.lines[0]?.currency ?? project.currency ?? "USD";

  // Expand/collapse — closed by default like ProfitLossCard above.
  const [open, setOpen] = React.useState(false);

  // Estimates in line currency, then FX-converted to USD at the
  // project's signing date so they can be compared to realized USD
  // totals on the same axis (matches dashboard P&L rollups).
  const tahminiSatisNative = selectSalesTotal(project);
  const tahminiAlimNative = selectPurchaseTotal(project);
  const tahminiSatisUsd = toUsdAtDate(
    tahminiSatisNative,
    lineCurrency,
    project.projectDate
  );
  const tahminiAlimUsd = toUsdAtDate(
    tahminiAlimNative,
    lineCurrency,
    project.projectDate
  );

  // Realized side: sales come pre-aggregated, purchases come from
  // the per-project rows in the global purchase cache.
  const gerceklesenSatisUsd = project.salesActualUsd ?? 0;
  const gerceklesenAlimUsd = useRealizedPurchaseUsd(project.projectNo);

  // P&L = Sales − Purchase (positive = profit)
  const tahminiKZ = tahminiSatisUsd - tahminiAlimUsd;
  const gerceklesenKZ = gerceklesenSatisUsd - gerceklesenAlimUsd;

  // Hide when nothing meaningful is available on any axis.
  if (
    tahminiSatisUsd <= 0 &&
    tahminiAlimUsd <= 0 &&
    gerceklesenSatisUsd <= 0 &&
    gerceklesenAlimUsd <= 0
  ) {
    return null;
  }

  // Tone of the realized P&L drives the icon + headline colour.
  const realizedTone: Tone =
    gerceklesenSatisUsd === 0 && gerceklesenAlimUsd === 0
      ? "neutral"
      : gerceklesenKZ > 0
        ? "positive"
        : gerceklesenKZ < 0
          ? "negative"
          : "neutral";
  const Icon =
    realizedTone === "positive"
      ? TrendingUp
      : realizedTone === "negative"
        ? TrendingDown
        : Minus;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 mb-3 text-left cursor-pointer hover:opacity-90 transition-colors"
        >
          <AccentIconBadge size="sm" tone={TONE_PL}>
            <Icon className="size-4" strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Realized P&amp;L
            </div>
            <div className="text-[13px] font-semibold leading-snug text-foreground/85">
              Tahmini × Gerçekleşen · Satış − Alım
            </div>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        <div className="rounded-xl border border-border/40 overflow-hidden">
          {/* Detail rows revealed only when expanded; the two K&Z
              totals at the bottom are always visible. */}
          {open && (
            <>
              <SectionHeader>Satış</SectionHeader>
              <StatRow
                label="Tahmini Satış"
                sub="Σ (ton × birim fiyat)"
                value={formatCurrency(tahminiSatisUsd, "USD")}
                muted
              />
              <StatRow
                label="Gerçekleşen Satış"
                sub="Σ faturalı satışlar (USD)"
                value={formatCurrency(gerceklesenSatisUsd, "USD")}
              />
              <SectionHeader>Alım</SectionHeader>
              <StatRow
                label="Tahmini Alım"
                sub="Σ (ton × alış fiyatı)"
                value={formatCurrency(tahminiAlimUsd, "USD")}
                muted
              />
              <StatRow
                label="Gerçekleşen Alım"
                sub="Σ tedarikçi faturaları (FX → USD)"
                value={formatCurrency(gerceklesenAlimUsd, "USD")}
              />
            </>
          )}

          {/* Bottom totals — always visible. Tahmini K&Z (smaller),
              Gerçekleşen K&Z (larger, tone-coloured) so the realized
              outcome is the dominant read. */}
          <KZRow
            label="Tahmini K&Z"
            sub="Tahmini Satış − Tahmini Alım"
            value={tahminiKZ}
            tone={
              tahminiSatisUsd === 0 && tahminiAlimUsd === 0
                ? "neutral"
                : tahminiKZ > 0
                  ? "positive"
                  : tahminiKZ < 0
                    ? "negative"
                    : "neutral"
            }
            size="sm"
          />
          <KZRow
            label="Gerçekleşen K&Z"
            sub="Gerçekleşen Satış − Gerçekleşen Alım"
            value={gerceklesenKZ}
            tone={realizedTone}
            size="lg"
          />
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Realized purchase totals ─────────── */

/**
 * Sum the project's vendor invoice rows from the cached
 * `mserp_tryaivendinvoicetransentities` slot (populated by the Veri
 * Yönetimi "Gerçekleşen Satınalma" refresh step). Each row's
 * `mserp_lineamount` is FX-converted to USD using its
 * `mserp_invoicedate` so currency mismatch never inflates the total.
 *
 * Memoised by `projectNo`; consumers automatically pick up new data
 * when the parent re-renders after a cache refresh.
 */
function useRealizedPurchaseUsd(projectNo: string): number {
  return React.useMemo(() => {
    if (!projectNo) return 0;
    const cached = readCache<Record<string, unknown>>(PURCHASE_ENTITY_SET);
    const all = cached?.value ?? [];
    let usd = 0;
    for (const r of all) {
      if (r["mserp_purchtable_etgtryprojid"] !== projectNo) continue;
      const amount = Number(r["mserp_lineamount"]);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const currency = String(r["mserp_currencycode"] ?? "USD")
        .trim()
        .toUpperCase();
      const date =
        typeof r["mserp_invoicedate"] === "string"
          ? (r["mserp_invoicedate"] as string)
          : null;
      usd += toUsdAtDate(amount, currency, date);
    }
    return usd;
  }, [projectNo]);
}

/* ─────────── Helpers ─────────── */

type Tone = "positive" | "negative" | "neutral";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-1.5 bg-foreground/[0.03] border-t border-border/30 first:border-t-0 text-[9.5px] font-bold uppercase tracking-[0.14em] text-foreground/70">
      {children}
    </div>
  );
}

function StatRow({
  label,
  sub,
  value,
  muted,
}: {
  label: string;
  sub?: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2.5 text-[11.5px] border-t border-border/30 first:border-t-0 items-baseline">
      <div className="min-w-0">
        <div className="font-medium text-foreground truncate">{label}</div>
        {sub && (
          <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
            {sub}
          </div>
        )}
      </div>
      <div
        className={cn(
          "text-right tabular-nums",
          muted ? "text-muted-foreground font-medium" : "font-bold text-foreground"
        )}
      >
        {value}
      </div>
    </div>
  );
}

const VALUE_COLOR: Record<Tone, string> = {
  positive: "text-emerald-700",
  neutral: "text-foreground",
  negative: "text-rose-700",
};

function KZRow({
  label,
  sub,
  value,
  tone,
  size,
}: {
  label: string;
  sub?: string;
  value: number;
  tone: Tone;
  /** "lg" gets the bigger headline treatment for the realized total. */
  size: "sm" | "lg";
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 items-baseline border-t border-border/40",
        size === "lg" ? "py-3 bg-foreground/[0.06]" : "py-2 bg-foreground/[0.03]"
      )}
    >
      <div className="min-w-0">
        <div
          className={cn(
            "uppercase tracking-wider font-semibold text-muted-foreground",
            size === "lg" ? "text-[10.5px]" : "text-[10px]"
          )}
        >
          {label}
        </div>
        {sub && (
          <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
            {sub}
          </div>
        )}
      </div>
      <div
        className={cn(
          "text-right tabular-nums font-bold",
          size === "lg" ? "text-[15px]" : "text-[12px]",
          VALUE_COLOR[tone]
        )}
      >
        {value > 0 ? "+" : value < 0 ? "−" : ""}
        {formatCurrency(Math.abs(value), "USD")}
      </div>
    </div>
  );
}

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
import { selectEstimateTotal } from "@/lib/selectors/project";
import { toUsdAtDate } from "@/lib/finance/fxRates";
import { readCache } from "@/lib/storage/entityCache";
import { useProjectExpenseLines } from "@/hooks/useProjectExpenseLines";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

const PURCHASE_ENTITY_SET = "mserp_tryaivendinvoicetransentities";

/**
 * "Realized P&L" — full sales × purchase × expense P&L resolution
 * for the selected project, both forecast and realized side-by-side.
 *
 *   Tahmini Satış  =  Σ (line.qty/1000) × line.unitPrice   (FX→USD)
 *   Gerçekleşen Satış  =  project.salesActualUsd
 *   Tahmini Alım   =  Σ (line.qty/1000) × line.purchasePrice (FX→USD)
 *   Gerçekleşen Alım  =  Σ rows from `mserp_tryaivendinvoicetransentities`
 *                        for the project, FX→USD per row date.
 *   Tahmini Gider  =  selectEstimateTotal(project)         (already USD)
 *   Gerçekleşen Gider =  Σ `mserp_amountcur` from the expense-line
 *                        entity (`mserp_tryaiexpenselineentities`),
 *                        joined via the dist entity on
 *                        `mserp_expensenum` per `useProjectExpenseLines`.
 *
 * Bottom totals (always visible — Tahmini first, Gerçekleşen second
 * per user spec):
 *   Tahmini K&Z       = Tahmini Satış − Tahmini Alım − Tahmini Gider
 *   Tahmini Marj %    = Tahmini K&Z / Tahmini Satış × 100
 *   Gerçekleşen K&Z   = Gerçekleşen Satış − Gerçekleşen Alım − Gerçekleşen Gider
 *   Gerçekleşen Marj %= Gerçekleşen K&Z / Gerçekleşen Satış × 100
 *
 * Each footer row matches the `ProfitLossCard` (Expected P&L) bottom
 * style — uppercase eyebrow + tone-coloured margin chip on the left,
 * signed bold value on the right. Same chip palette (emerald >5%,
 * rose <-5%, slate otherwise).
 *
 * Hides itself entirely when every metric is zero.
 */
export function BudgetSalesCard({ project }: Props) {
  const lineCurrency = project.lines[0]?.currency ?? project.currency ?? "USD";

  // Expand/collapse — closed by default, matches ProfitLossCard.
  const [open, setOpen] = React.useState(false);

  /* ─────────── Estimates (line currency → USD via project-date FX) ─────────── */
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
  // Gider estimate already USD per F&O entity model.
  const tahminiGiderUsd = selectEstimateTotal(project);

  /* ─────────── Realized side ─────────── */
  const gerceklesenSatisUsd = project.salesActualUsd ?? 0;
  const gerceklesenAlimUsd = useRealizedPurchaseUsd(project.projectNo);
  // Authoritative realized expenses come from the same 2-step chain
  // the Veri Yönetimi tab uses. `mserp_amountcur` is treated as USD
  // — the entity doesn't expose `mserp_currencycode`, so there's no
  // FX context to convert against.
  const expenseLines = useProjectExpenseLines(project.projectNo);
  const gerceklesenGiderUsd = React.useMemo(() => {
    let sum = 0;
    for (const r of expenseLines.rows) {
      const amount = Number(r["mserp_amountcur"]);
      if (Number.isFinite(amount)) sum += amount;
    }
    return sum;
  }, [expenseLines.rows]);

  /* ─────────── P&L resolutions ─────────── */
  const tahminiKZ = tahminiSatisUsd - tahminiAlimUsd - tahminiGiderUsd;
  const gerceklesenKZ =
    gerceklesenSatisUsd - gerceklesenAlimUsd - gerceklesenGiderUsd;

  // Margin = K&Z / Satış × 100. Null when sales is zero (no
  // reference frame for percentage).
  const tahminiMargin =
    tahminiSatisUsd > 0 ? (tahminiKZ / tahminiSatisUsd) * 100 : null;
  const gerceklesenMargin =
    gerceklesenSatisUsd > 0
      ? (gerceklesenKZ / gerceklesenSatisUsd) * 100
      : null;

  // Hide when every figure is zero — keeps the right rail clean.
  if (
    tahminiSatisUsd <= 0 &&
    tahminiAlimUsd <= 0 &&
    tahminiGiderUsd <= 0 &&
    gerceklesenSatisUsd <= 0 &&
    gerceklesenAlimUsd <= 0 &&
    gerceklesenGiderUsd <= 0
  ) {
    return null;
  }

  /* ─────────── Header tone — driven by Realized K&Z ─────────── */
  const realizedTone: Tone =
    gerceklesenSatisUsd === 0 &&
    gerceklesenAlimUsd === 0 &&
    gerceklesenGiderUsd === 0
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
              Gerçekleşen Kâr &amp; Zarar
            </div>
            <div className="text-[13px] font-semibold leading-snug text-foreground/85">
              Realized P&amp;L
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
              <SectionHeader>Gider</SectionHeader>
              <StatRow
                label="Tahmini Gider"
                sub="Σ tahmini gider satırları (USD)"
                value={formatCurrency(tahminiGiderUsd, "USD")}
                muted
              />
              <StatRow
                label="Gerçekleşen Gider"
                sub="Σ gerçekleşen masraf satırları (USD)"
                value={formatCurrency(gerceklesenGiderUsd, "USD")}
              />
            </>
          )}

          {/* Bottom totals — Tahmini first, Gerçekleşen second.
              Each row matches the ProfitLossCard footer layout
              (uppercase eyebrow + tone-coloured margin chip on the
              left, signed bold value on the right). */}
          <KZFooterRow
            label="Tahmini Kâr / Zarar"
            marginLabel="Tahmini marj"
            value={tahminiKZ}
            marginPct={tahminiMargin}
          />
          <KZFooterRow
            label="Gerçekleşen Kâr / Zarar"
            marginLabel="Gerçekleşen marj"
            value={gerceklesenKZ}
            marginPct={gerceklesenMargin}
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

/**
 * Footer row matching the ProfitLossCard "Tahmini Kâr / Zarar" block
 * one-for-one: uppercase eyebrow label, tone-coloured margin chip
 * underneath, signed bold value on the right. Used twice (Tahmini
 * row + Gerçekleşen row) so both K&Z resolutions read with the same
 * visual language as the Expected P&L card.
 */
function KZFooterRow({
  label,
  marginLabel,
  value,
  marginPct,
}: {
  label: string;
  marginLabel: string;
  value: number;
  marginPct: number | null;
}) {
  const positive = value > 0;
  const negative = value < 0;

  // Margin tone — drives chip colour. Same thresholds as
  // `aggregateMarginDistribution` in the dashboard so the right rail
  // and the executive rollup agree on what counts as "healthy".
  const marginTone: Tone =
    marginPct == null
      ? "neutral"
      : marginPct > 5
        ? "positive"
        : marginPct < -5
          ? "negative"
          : "neutral";

  const valueColor = positive
    ? "text-emerald-700"
    : negative
      ? "text-rose-700"
      : "text-foreground";

  // Chip colours match the ProfitLossCard palette (rgb literals so
  // the inline styles don't depend on Tailwind class generation).
  const marginColor =
    marginTone === "positive"
      ? "rgb(4 120 87)"
      : marginTone === "negative"
        ? "rgb(159 18 57)"
        : "rgb(71 85 105)";
  const marginBg =
    marginTone === "positive"
      ? "rgba(16,185,129,0.12)"
      : marginTone === "negative"
        ? "rgba(244,63,94,0.12)"
        : "rgba(100,116,139,0.12)";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2.5 text-[11.5px] bg-foreground/[0.04] items-baseline border-t border-border/40">
      <div className="min-w-0">
        <div className="font-semibold uppercase tracking-wider text-[10.5px] text-muted-foreground">
          {label}
        </div>
        {marginPct != null && (
          <span
            className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums tracking-tight"
            style={{ color: marginColor, backgroundColor: marginBg }}
          >
            {marginLabel} %{marginPct.toFixed(1)}
          </span>
        )}
      </div>
      <div
        className={cn("text-right tabular-nums text-[13px] font-bold", valueColor)}
      >
        {value >= 0 ? "+" : "−"}
        {formatCurrency(Math.abs(value), "USD")}
      </div>
    </div>
  );
}

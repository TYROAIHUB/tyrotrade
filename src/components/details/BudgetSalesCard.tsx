import * as React from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
} from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import {
  AccentIconBadge,
  TONE_PL,
  TONE_EXPENSE,
  TONE_FORECAST,
} from "./AccentIconBadge";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  selectSalesTotal,
  selectPurchaseTotal,
} from "@/lib/selectors/profitLoss";
import { selectEstimateTotal } from "@/lib/selectors/project";
import { toUsdAtDate } from "@/lib/finance/fxRates";
import { readCache } from "@/lib/storage/entityCache";
import { useProjectInvoices } from "@/hooks/useProjectInvoices";
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
 * Mirrors the ProfitLossCard ("Expected P&L") layout pattern:
 *   - Top toggle expands the whole card.
 *   - Each section row (Tahmini/Gerçekleşen × Satış/Alım/Gider) is
 *     itself an `ExpandableRow` carrying a +/- signed value chip
 *     in the appropriate emerald/rose tone, and revealing per-line
 *     `DetailLine` breakdowns when opened.
 *   - Footer carries two K&Z resolutions (Tahmini first, Gerçekleşen
 *     second) with margin chips, in the same visual dialect as
 *     ProfitLossCard's single footer.
 *
 * Estimates side: same line math the Expected P&L card uses
 *   (line.qty/1000) × line.unitPrice / line.purchasePrice, plus the
 *   project's `costEstimateLines`. Totals FX-converted to USD at the
 *   project's signing date so estimated and realized sit on the same
 *   axis.
 *
 * Realized side:
 *   - Satış  ← `useProjectInvoices` rows, each FX→USD per
 *              `mserp_invoicedate`
 *   - Alım   ← `mserp_tryaivendinvoicetransentities` cache rows
 *              filtered by `mserp_purchtable_etgtryprojid`,
 *              FX→USD per `mserp_invoicedate`
 *   - Gider  ← `useProjectExpenseLines` rows (the 2-step chain via
 *              the dist entity); `mserp_amountcur` summed as USD
 *              (entity doesn't expose currencycode).
 *
 * Hides itself entirely when every figure is zero.
 */
export function BudgetSalesCard({ project }: Props) {
  const lines = project.lines ?? [];
  const lineCurrency = lines[0]?.currency ?? project.currency ?? "USD";
  const [open, setOpen] = React.useState(false);

  /* ─────────── Invoice item label lookup (shared helper) ───────────
   * Project lines carry only the F&O item code (no Turkish product
   * name). Customer invoices DO carry a `mserp_name` per item, so
   * build a code→name map from invoices to enrich the estimate
   * line breakdown — same trick ProfitLossCard uses. */
  const { invoices } = useProjectInvoices(project.projectNo);
  const productNameByCode = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of invoices) {
      const code = String(inv["mserp_itemid"] ?? "").trim();
      const name = String(inv["mserp_name"] ?? "").trim();
      if (!code || !name) continue;
      if (!map.has(code)) map.set(code, name);
    }
    return map;
  }, [invoices]);
  const labelFor = React.useCallback(
    (code: string) => productNameByCode.get(code) ?? code,
    [productNameByCode]
  );

  /* ─────────── Estimate line breakdowns ─────────── */
  const tahminiSalesLines = React.useMemo(
    () =>
      lines
        .filter((l) => l.unitPrice > 0 && l.quantityKg > 0)
        .map((l) => ({
          label: labelFor(l.itemCode),
          tons: l.quantityKg / 1000,
          price: l.unitPrice,
          totalNative: (l.quantityKg / 1000) * l.unitPrice,
        })),
    [lines, labelFor]
  );
  const tahminiPurchaseLines = React.useMemo(
    () =>
      lines
        .filter((l) => (l.purchasePrice ?? 0) > 0 && l.quantityKg > 0)
        .map((l) => ({
          label: labelFor(l.itemCode),
          tons: l.quantityKg / 1000,
          price: l.purchasePrice ?? 0,
          totalNative: (l.quantityKg / 1000) * (l.purchasePrice ?? 0),
        })),
    [lines, labelFor]
  );
  const tahminiExpenseLines = React.useMemo(
    () => project.costEstimateLines ?? [],
    [project.costEstimateLines]
  );

  /* ─────────── Estimate totals (USD-equivalent at projectDate) ─────────── */
  const tahminiSatisUsd = toUsdAtDate(
    selectSalesTotal(project),
    lineCurrency,
    project.projectDate
  );
  const tahminiAlimUsd = toUsdAtDate(
    selectPurchaseTotal(project),
    lineCurrency,
    project.projectDate
  );
  const tahminiGiderUsd = selectEstimateTotal(project);

  /* ─────────── Realized line breakdowns ─────────── */
  // Sales — invoices carry per-line currency + invoice date, so
  // FX-convert each row before summing. Filter zero-amount rows so
  // the breakdown count reflects substantive postings only.
  const gerceklesenSalesLines = React.useMemo(() => {
    return invoices
      .map((inv) => {
        const amount = Number(inv["mserp_lineamount"]);
        if (!Number.isFinite(amount) || amount === 0) return null;
        const cur = String(inv["mserp_currencycode"] ?? "USD")
          .trim()
          .toUpperCase();
        const date =
          typeof inv["mserp_invoicedate"] === "string"
            ? (inv["mserp_invoicedate"] as string)
            : null;
        const qty = Number(inv["mserp_qty"]);
        return {
          label: String(inv["mserp_name"] ?? inv["mserp_itemid"] ?? "—"),
          tons: Number.isFinite(qty) ? qty / 1000 : 0,
          nativeAmount: amount,
          nativeCurrency: cur,
          totalUsd: toUsdAtDate(amount, cur, date),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  }, [invoices]);
  const gerceklesenSatisUsd = gerceklesenSalesLines.reduce(
    (s, l) => s + l.totalUsd,
    0
  );

  // Purchase — read cached vendor invoice rows scoped to the
  // selected project, same FX treatment as sales.
  const gerceklesenPurchaseLines = React.useMemo(() => {
    if (!project.projectNo) return [];
    const cached = readCache<Record<string, unknown>>(PURCHASE_ENTITY_SET);
    const all = cached?.value ?? [];
    return all
      .filter((r) => r["mserp_purchtable_etgtryprojid"] === project.projectNo)
      .map((r) => {
        const amount = Number(r["mserp_lineamount"]);
        if (!Number.isFinite(amount) || amount === 0) return null;
        const cur = String(r["mserp_currencycode"] ?? "USD")
          .trim()
          .toUpperCase();
        const date =
          typeof r["mserp_invoicedate"] === "string"
            ? (r["mserp_invoicedate"] as string)
            : null;
        const qty = Number(r["mserp_qty"]);
        return {
          label: String(r["mserp_name"] ?? r["mserp_itemid"] ?? "—"),
          tons: Number.isFinite(qty) ? qty / 1000 : 0,
          nativeAmount: amount,
          nativeCurrency: cur,
          totalUsd: toUsdAtDate(amount, cur, date),
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  }, [project.projectNo]);
  const gerceklesenAlimUsd = gerceklesenPurchaseLines.reduce(
    (s, l) => s + l.totalUsd,
    0
  );

  // Expense — 2-step chain via `useProjectExpenseLines`. Amounts
  // treated as USD because the expense-line entity doesn't expose a
  // currency column.
  const expenseLineQuery = useProjectExpenseLines(project.projectNo);
  const gerceklesenExpenseLines = React.useMemo(
    () =>
      expenseLineQuery.rows
        .map((r) => {
          const amount = Number(r["mserp_amountcur"]);
          if (!Number.isFinite(amount) || amount === 0) return null;
          const description = String(r["mserp_description"] ?? "").trim();
          const expenseId = String(r["mserp_expenseid"] ?? "").trim();
          const expensenum = String(r["mserp_expensenum"] ?? "").trim();
          return {
            label: description || expenseId || expensenum || "—",
            expenseId,
            expensenum,
            totalUsd: amount,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
    [expenseLineQuery.rows]
  );
  const gerceklesenGiderUsd = gerceklesenExpenseLines.reduce(
    (s, l) => s + l.totalUsd,
    0
  );

  /* ─────────── P&L resolutions ─────────── */
  const tahminiKZ = tahminiSatisUsd - tahminiAlimUsd - tahminiGiderUsd;
  const gerceklesenKZ =
    gerceklesenSatisUsd - gerceklesenAlimUsd - gerceklesenGiderUsd;

  const tahminiMargin =
    tahminiSatisUsd > 0 ? (tahminiKZ / tahminiSatisUsd) * 100 : null;
  const gerceklesenMargin =
    gerceklesenSatisUsd > 0
      ? (gerceklesenKZ / gerceklesenSatisUsd) * 100
      : null;

  // Auto-hide when nothing meaningful exists on any side.
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
  // Icon-pill background follows the tone too:
  //   positive (profit)   → emerald TONE_PL  (no change)
  //   negative (loss)     → rose TONE_EXPENSE (was emerald — misleading)
  //   neutral / no data   → TONE_FORECAST (matches the now-removed
  //                         Expected P&L card so neutral surfaces
  //                         keep the same chrome)
  const iconTone =
    realizedTone === "positive"
      ? TONE_PL
      : realizedTone === "negative"
        ? TONE_EXPENSE
        : TONE_FORECAST;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 mb-3 text-left cursor-pointer hover:opacity-90 transition-colors"
        >
          <AccentIconBadge size="sm" tone={iconTone}>
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
              {/* ─── Satış ─── */}
              <SectionHeader>Satış</SectionHeader>
              <ExpandableRow
                label="Tahmini Satış"
                count={tahminiSalesLines.length}
                countLabel="satış kalemi"
                value={`+${formatCurrency(tahminiSatisUsd, "USD")}`}
                sign="positive"
                disabled={tahminiSalesLines.length === 0}
                faded={tahminiSatisUsd === 0}
              >
                {tahminiSalesLines.map((l, i) => (
                  <DetailLine
                    key={i}
                    code={l.label}
                    sub={`${formatNumber(l.tons, 0)} t × ${formatCurrency(l.price, lineCurrency, { maximumFractionDigits: 2 })} / t`}
                    total={`+${formatCurrency(l.totalNative, lineCurrency)}`}
                    sign="positive"
                  />
                ))}
              </ExpandableRow>
              <ExpandableRow
                label="Gerçekleşen Satış"
                count={gerceklesenSalesLines.length}
                countLabel="fatura kalemi"
                value={`+${formatCurrency(gerceklesenSatisUsd, "USD")}`}
                sign="positive"
                disabled={gerceklesenSalesLines.length === 0}
                faded={gerceklesenSatisUsd === 0}
              >
                {gerceklesenSalesLines.map((l, i) => (
                  <DetailLine
                    key={i}
                    code={l.label}
                    sub={subForRealizedLine(l)}
                    total={`+${formatCurrency(l.totalUsd, "USD")}`}
                    sign="positive"
                  />
                ))}
              </ExpandableRow>

              {/* ─── Alım ─── */}
              <SectionHeader>Alım</SectionHeader>
              <ExpandableRow
                label="Tahmini Alım"
                count={tahminiPurchaseLines.length}
                countLabel="alım kalemi"
                value={`-${formatCurrency(tahminiAlimUsd, "USD")}`}
                sign="negative"
                disabled={tahminiPurchaseLines.length === 0}
                faded={tahminiAlimUsd === 0}
              >
                {tahminiPurchaseLines.map((l, i) => (
                  <DetailLine
                    key={i}
                    code={l.label}
                    sub={`${formatNumber(l.tons, 0)} t × ${formatCurrency(l.price, lineCurrency, { maximumFractionDigits: 2 })} / t`}
                    total={`-${formatCurrency(l.totalNative, lineCurrency)}`}
                    sign="negative"
                  />
                ))}
              </ExpandableRow>
              <ExpandableRow
                label="Gerçekleşen Alım"
                count={gerceklesenPurchaseLines.length}
                countLabel="tedarikçi faturası"
                value={`-${formatCurrency(gerceklesenAlimUsd, "USD")}`}
                sign="negative"
                disabled={gerceklesenPurchaseLines.length === 0}
                faded={gerceklesenAlimUsd === 0}
              >
                {gerceklesenPurchaseLines.map((l, i) => (
                  <DetailLine
                    key={i}
                    code={l.label}
                    sub={subForRealizedLine(l)}
                    total={`-${formatCurrency(l.totalUsd, "USD")}`}
                    sign="negative"
                  />
                ))}
              </ExpandableRow>

              {/* ─── Gider ─── */}
              <SectionHeader>Gider</SectionHeader>
              <ExpandableRow
                label="Tahmini Gider"
                count={tahminiExpenseLines.length}
                countLabel="gider kalemi"
                value={`-${formatCurrency(tahminiGiderUsd, "USD")}`}
                sign="negative"
                disabled={tahminiExpenseLines.length === 0}
                faded={tahminiGiderUsd === 0}
              >
                {tahminiExpenseLines.map((l, i) => (
                  <DetailLine
                    key={i}
                    code={l.name}
                    sub={`${formatNumber(l.tons, 0)} t × ${formatCurrency(l.unitPriceUsd, "USD", { maximumFractionDigits: 2 })} / t`}
                    total={`-${formatCurrency(l.totalUsd, "USD")}`}
                    sign="negative"
                  />
                ))}
              </ExpandableRow>
              <ExpandableRow
                label="Gerçekleşen Gider"
                count={gerceklesenExpenseLines.length}
                countLabel="masraf kaydı"
                value={`-${formatCurrency(gerceklesenGiderUsd, "USD")}`}
                sign="negative"
                disabled={gerceklesenExpenseLines.length === 0}
                faded={gerceklesenGiderUsd === 0}
              >
                {gerceklesenExpenseLines.map((l, i) => (
                  <DetailLine
                    key={i}
                    code={l.label}
                    sub={
                      l.expenseId
                        ? `Masraf Kalemi: ${l.expenseId}`
                        : l.expensenum
                          ? `Masraf No: ${l.expensenum}`
                          : ""
                    }
                    total={`-${formatCurrency(l.totalUsd, "USD")}`}
                    sign="negative"
                  />
                ))}
              </ExpandableRow>
            </>
          )}

          {/* Footer totals — Tahmini first, Gerçekleşen second.
              Each row mirrors the ProfitLossCard footer layout. */}
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

/* ─────────── Realized-line subtitle helper ─────────── */
/**
 * Pretty-print the per-line subtitle for a realized invoice/purchase
 * row: "X t · $Y" when both quantity and a different native currency
 * are usable, otherwise falls back to whichever piece is meaningful.
 * Hides redundancy — we don't repeat USD when totals are already in
 * USD on the right side.
 */
function subForRealizedLine(l: {
  tons: number;
  nativeAmount: number;
  nativeCurrency: string;
}): string {
  const tonsPart =
    Number.isFinite(l.tons) && l.tons > 0
      ? `${formatNumber(l.tons, 0)} t`
      : "";
  const nativePart =
    l.nativeCurrency && l.nativeCurrency !== "USD"
      ? formatCurrency(l.nativeAmount, l.nativeCurrency)
      : "";
  if (tonsPart && nativePart) return `${tonsPart} · ${nativePart}`;
  return tonsPart || nativePart;
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

/* ─────────── Expandable section row ───────────
 * Verbatim copy of ProfitLossCard's `ExpandableRow` so the two cards
 * stack with identical row chrome. Local rather than shared so each
 * card's behaviour can drift independently if needed (e.g. the
 * Realized side might surface FX hover later). */
function ExpandableRow({
  label,
  count,
  countLabel,
  value,
  sign,
  faded = false,
  disabled = false,
  children,
}: {
  label: string;
  count: number;
  countLabel: string;
  value: string;
  sign: Tone;
  faded?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const valueColor =
    sign === "positive"
      ? "text-emerald-700"
      : sign === "negative"
        ? "text-rose-700"
        : "text-foreground";
  return (
    <div
      className={cn(
        "border-t border-border/30 first:border-t-0",
        faded && "opacity-55"
      )}
    >
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={cn(
          "w-full grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2 text-[11.5px] items-baseline transition-colors text-left",
          !disabled && "hover:bg-foreground/[0.025] cursor-pointer",
          disabled && "cursor-default"
        )}
        aria-expanded={open}
      >
        <div className="min-w-0 flex items-center gap-1">
          <ChevronDown
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
              disabled && "opacity-40"
            )}
          />
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{label}</div>
            <div className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
              {count} {countLabel}
            </div>
          </div>
        </div>
        <div
          className={cn("text-right tabular-nums font-semibold", valueColor)}
        >
          {value}
        </div>
      </button>
      {open && children && (
        <div className="bg-foreground/[0.025] px-3 pb-2.5 pt-1 border-t border-border/20">
          <div className="space-y-1">{children}</div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Detail line shown inside an expanded row ───────────
 * Same shape as ProfitLossCard's `DetailLine` but the `sub` is a
 * pre-formatted string so each section can carry its own subtitle
 * dialect (tons × rate for estimates, native currency / expense
 * code / etc. for realized). */
function DetailLine({
  code,
  sub,
  total,
  sign,
}: {
  code: string;
  sub: string;
  total: string;
  sign: "positive" | "negative";
}) {
  const valueColor =
    sign === "positive" ? "text-emerald-700" : "text-rose-700";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-0.5 tabular-nums items-baseline">
      <div className="min-w-0">
        <div className="text-[12px] text-foreground/90 line-clamp-2 font-medium leading-snug">
          {code}
        </div>
        {sub && (
          <div className="text-muted-foreground/90 text-[11px] truncate mt-0.5">
            {sub}
          </div>
        )}
      </div>
      <div
        className={cn("text-right font-semibold text-[12px]", valueColor)}
      >
        {total}
      </div>
    </div>
  );
}

/* ─────────── K&Z footer row (mirrors ProfitLossCard footer) ─────────── */
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

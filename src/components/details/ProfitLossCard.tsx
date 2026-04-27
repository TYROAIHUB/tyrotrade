import * as React from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_FORECAST } from "./AccentIconBadge";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useProjectInvoices } from "@/hooks/useProjectInvoices";
import { selectProjectPL } from "@/lib/selectors/profitLoss";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

/**
 * "Tahmini Kâr & Zarar" — estimated P&L card for the right rail.
 *
 *   Sales total    = Σ ((quantityKg / 1000) × unitPrice)        ← `mserp_unitprice`
 *   Purchase total = Σ ((quantityKg / 1000) × purchasePrice)    ← `mserp_salesprice`
 *   Expense total  = Σ costEstimateLines[i].totalUsd
 *
 *   P&L = Sales − Purchase − Expense
 *
 * Each top row is collapsible — header shows label + line count and a
 * chevron; expanding reveals the per-line breakdown that mirrors the
 * removed EstimatedExpenseCard's display ("opex · 0,70 $/t × 30.000 t
 * = 21.000 $"). The whole P&L picture lives in one card now.
 *
 * Card hides when neither sales nor purchase prices are filled — no
 * meaningful estimate possible.
 */
export function ProfitLossCard({ project }: Props) {
  const lines = project.lines ?? [];
  const currency = lines[0]?.currency ?? project.currency ?? "USD";

  // Project lines carry only the F&O item code (no Turkish product
  // name). Invoice transactions DO have a `mserp_name` per item, so
  // build a code→name lookup the same way `CommoditySalesCard` does
  // for its tooltip — falling back to the raw code when nothing
  // matches.
  const { invoices } = useProjectInvoices(project.projectNo);
  const productNameByCode = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const inv of invoices) {
      const code = String(inv["mserp_itemid"] ?? "").trim();
      const name = String(inv["mserp_name"] ?? "").trim();
      if (!code || !name) continue;
      // First non-empty name we see wins — invoices for the same code
      // can carry slightly different copies; pick once and stick.
      if (!map.has(code)) map.set(code, name);
    }
    return map;
  }, [invoices]);
  const labelFor = React.useCallback(
    (code: string) => productNameByCode.get(code) ?? code,
    [productNameByCode]
  );

  const salesLines = React.useMemo(
    () =>
      lines
        .filter((l) => l.unitPrice > 0 && l.quantityKg > 0)
        .map((l) => ({
          itemCode: l.itemCode,
          label: labelFor(l.itemCode),
          tons: l.quantityKg / 1000,
          price: l.unitPrice,
          total: (l.quantityKg / 1000) * l.unitPrice,
        })),
    [lines, labelFor]
  );
  const purchaseLines = React.useMemo(
    () =>
      lines
        .filter((l) => (l.purchasePrice ?? 0) > 0 && l.quantityKg > 0)
        .map((l) => ({
          itemCode: l.itemCode,
          label: labelFor(l.itemCode),
          tons: l.quantityKg / 1000,
          price: l.purchasePrice ?? 0,
          total: (l.quantityKg / 1000) * (l.purchasePrice ?? 0),
        })),
    [lines, labelFor]
  );
  const expenseLines = project.costEstimateLines ?? [];

  // Totals come from the shared P&L selector — same math as the dashboard
  // tiles, no risk of the card drifting from the executive rollup. The
  // per-line arrays above are still computed locally because they carry
  // UI-specific formatting (labels, tons, rates) that the selector
  // intentionally doesn't expose.
  const { salesTotal, purchaseTotal, expenseTotal, pl, marginPct } =
    selectProjectPL(project);

  // Detail rows hidden by default — show only the bottom-line P&L
  // until the user asks for the full Satış/Alım/Gider breakdown.
  // Each section row keeps its own expand state, so opening the top
  // toggle reveals the rows; opening a row reveals its line-by-line
  // math.
  const [open, setOpen] = React.useState(false);

  if (salesTotal <= 0 && purchaseTotal <= 0) return null;

  const positive = pl > 0;
  const negative = pl < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  // Faded sentiment colour for the margin chip — soft enough to read
  // as "estimate", strong enough to communicate direction.
  const marginColor = positive
    ? "rgb(4 120 87)" // emerald-700
    : negative
      ? "rgb(159 18 57)" // rose-700
      : "rgb(71 85 105)"; // slate-600
  const marginBg = positive
    ? "rgba(16,185,129,0.12)"
    : negative
      ? "rgba(244,63,94,0.12)"
      : "rgba(100,116,139,0.12)";

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        {/* Header doubles as the top-level expand/collapse toggle so
            the title block is a comfortable click target. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full flex items-center gap-2.5 mb-3 text-left cursor-pointer hover:opacity-90 transition-colors"
        >
          <AccentIconBadge size="sm" tone={TONE_FORECAST}>
            <Icon className="size-4" strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Tahmini Kâr &amp; Zarar
            </div>
            <div className="text-[13px] font-semibold leading-snug text-foreground/85">
              Expected P&amp;L
            </div>
          </div>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {/* Breakdown table — three expandable section rows (only
            visible when the top toggle is open) + the P&L footer
            that resolves them. */}
        <div className="rounded-xl border border-border/40 overflow-hidden">
          {open && (
            <>
          <ExpandableRow
            label="Tahmini Satış"
            count={salesLines.length}
            countLabel="satış kalemi"
            value={`+${formatCurrency(salesTotal, currency)}`}
            sign="positive"
            disabled={salesLines.length === 0}
          >
            {salesLines.map((l, i) => (
              <DetailLine
                key={i}
                code={l.label}
                tons={l.tons}
                rate={`${formatCurrency(l.price, currency, { maximumFractionDigits: 2 })} / t`}
                total={`+${formatCurrency(l.total, currency)}`}
                sign="positive"
              />
            ))}
          </ExpandableRow>
          <ExpandableRow
            label="Tahmini Alım"
            count={purchaseLines.length}
            countLabel="alım kalemi"
            value={`-${formatCurrency(purchaseTotal, currency)}`}
            sign="negative"
            disabled={purchaseLines.length === 0}
            faded={purchaseTotal === 0}
          >
            {purchaseLines.map((l, i) => (
              <DetailLine
                key={i}
                code={l.label}
                tons={l.tons}
                rate={`${formatCurrency(l.price, currency, { maximumFractionDigits: 2 })} / t`}
                total={`-${formatCurrency(l.total, currency)}`}
                sign="negative"
              />
            ))}
          </ExpandableRow>
          <ExpandableRow
            label="Tahmini Gider"
            count={expenseLines.length}
            countLabel="gider kalemi"
            value={`-${formatCurrency(expenseTotal, currency)}`}
            sign="negative"
            disabled={expenseLines.length === 0}
            faded={expenseTotal === 0}
          >
            {expenseLines.map((l, i) => (
              <DetailLine
                key={i}
                code={l.name}
                tons={l.tons}
                rate={`${formatCurrency(l.unitPriceUsd, "USD", { maximumFractionDigits: 2 })} / t`}
                total={`-${formatCurrency(l.totalUsd, "USD")}`}
                sign="negative"
              />
            ))}
          </ExpandableRow>
            </>
          )}

          {/* Footer total — always visible; carries the P&L resolution
              and the margin chip. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2.5 text-[11.5px] bg-foreground/[0.04] items-baseline">
            <div className="min-w-0">
              <div className="font-semibold uppercase tracking-wider text-[10.5px] text-muted-foreground">
                Tahmini Kâr / Zarar
              </div>
              {marginPct != null && (
                <span
                  className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums tracking-tight"
                  style={{ color: marginColor, backgroundColor: marginBg }}
                >
                  Tahmini marj %{marginPct.toFixed(1)}
                </span>
              )}
            </div>
            <div
              className={cn(
                "text-right tabular-nums text-[13px] font-bold",
                positive
                  ? "text-emerald-700"
                  : negative
                    ? "text-rose-700"
                    : "text-foreground"
              )}
            >
              {pl >= 0 ? "+" : "−"}
              {formatCurrency(Math.abs(pl), currency)}
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Expandable row ─────────── */

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
  sign: "positive" | "negative" | "neutral";
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
    <div className={cn("border-t border-border/30 first:border-t-0", faded && "opacity-55")}>
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
        <div className={cn("text-right tabular-nums font-semibold", valueColor)}>
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

/* ─────────── Detail line shown inside an expanded row ─────────── */

function DetailLine({
  code,
  tons,
  rate,
  total,
  sign,
}: {
  code: string;
  tons: number;
  rate: string;
  total: string;
  sign: "positive" | "negative";
}) {
  const valueColor = sign === "positive" ? "text-emerald-700" : "text-rose-700";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-0.5 tabular-nums items-baseline">
      <div className="min-w-0">
        <div className="text-[12px] text-foreground/90 line-clamp-2 font-medium leading-snug">
          {code}
        </div>
        <div className="text-muted-foreground/90 text-[11px] truncate mt-0.5">
          {formatNumber(tons, 0)} t × {rate}
        </div>
      </div>
      <div className={cn("text-right font-semibold text-[12px]", valueColor)}>
        {total}
      </div>
    </div>
  );
}

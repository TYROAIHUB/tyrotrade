import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GlassPanel } from "@/components/glass/GlassPanel";
import { AccentIconBadge, TONE_PL } from "./AccentIconBadge";
import { formatCurrency } from "@/lib/format";
import { selectSalesTotal } from "@/lib/selectors/profitLoss";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/dataverse/entities";

interface Props {
  project: Project;
}

/**
 * "Gerçekleşen Kâr & Zarar" — replaces the previous segment-budget vs
 * actual-sales view with a simpler **Tahmini Satış × Gerçekleşen Satış**
 * comparison. Segment budgets aren't a concept in this dataset
 * anymore, but every project still has both:
 *
 *   - Tahmini Satış  =  Σ (line.quantityKg / 1000) × line.unitPrice
 *   - Gerçekleşen Satış  =  project.salesActualUsd
 *
 * The delta (Gerçekleşen − Tahmini) is the realized vs forecast
 * variance. Positive = sales overshot the plan, negative = shortfall.
 *
 * Hides itself entirely when neither side carries a value — keeps the
 * right rail clean for projects that haven't priced or billed yet.
 */
export function BudgetSalesCard({ project }: Props) {
  const lines = project.lines ?? [];
  const currency = lines[0]?.currency ?? project.currency ?? "USD";

  const tahminiSatis = selectSalesTotal(project);
  const gerceklesenSatis = project.salesActualUsd ?? 0;

  // Hide when neither side has a value — nothing meaningful to show.
  if (tahminiSatis <= 0 && gerceklesenSatis <= 0) return null;

  const delta = gerceklesenSatis - tahminiSatis;
  const deltaPct = tahminiSatis > 0 ? (delta / tahminiSatis) * 100 : null;

  // Realised-vs-forecast tone follows the SIGN of the delta:
  //   +%5..+∞  → emerald (overshot, good)
  //   -%5..+%5 → slate  (on target)
  //   <-%5     → rose   (shortfall)
  const tone =
    deltaPct == null
      ? "neutral"
      : deltaPct > 5
        ? "positive"
        : deltaPct < -5
          ? "negative"
          : "neutral";

  const Icon =
    tone === "positive" ? TrendingUp : tone === "negative" ? TrendingDown : Minus;

  const valueColorClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-rose-700"
        : "text-foreground";

  // Simple progress visualization — what % of estimated sales did we
  // actually achieve? Capped at 150% so a wild overshoot doesn't blow
  // out the bar; chip still shows the true number.
  const achievedPct =
    tahminiSatis > 0 ? (gerceklesenSatis / tahminiSatis) * 100 : null;

  return (
    <GlassPanel tone="default" className="rounded-2xl">
      <div className="p-4">
        <div className="flex items-center gap-2.5 mb-3">
          <AccentIconBadge size="sm" tone={TONE_PL}>
            <Icon className="size-4" strokeWidth={2} />
          </AccentIconBadge>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Gerçekleşen Kâr &amp; Zarar
            </div>
            <div className="text-[13px] font-semibold leading-snug text-foreground/85">
              Tahmini × Gerçekleşen Satış
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/40 overflow-hidden">
          {/* Two side-by-side stat rows: Tahmini, then Gerçekleşen. */}
          <StatRow
            label="Tahmini Satış"
            sub="Σ (ton × birim fiyat)"
            value={formatCurrency(tahminiSatis, currency)}
            muted
          />
          <StatRow
            label="Gerçekleşen Satış"
            sub="Σ faturalı satışlar (USD)"
            value={formatCurrency(gerceklesenSatis, "USD")}
          />
          {/* Delta row — sign-coloured, % vs estimate */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-3 py-2.5 bg-foreground/[0.04] items-baseline">
            <div className="min-w-0">
              <div className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
                Δ Sapma
              </div>
              {deltaPct != null && (
                <div className="text-[10.5px] text-muted-foreground/80 mt-0.5">
                  Tahminin {deltaPct >= 0 ? "üstünde" : "altında"}
                </div>
              )}
            </div>
            <div className="text-right">
              <div
                className={cn(
                  "tabular-nums font-bold text-[13px]",
                  valueColorClass
                )}
              >
                {delta >= 0 ? "+" : "−"}
                {formatCurrency(Math.abs(delta), "USD")}
              </div>
              {deltaPct != null && (
                <div
                  className={cn(
                    "text-[10.5px] tabular-nums font-semibold mt-0.5",
                    valueColorClass
                  )}
                >
                  {deltaPct >= 0 ? "+" : ""}
                  {deltaPct.toFixed(1)}%
                </div>
              )}
            </div>
          </div>
          {/* Achievement bar — colored by tone, capped at 150% so wild
              overshoots don't blow out the visual but the chip still
              shows the real number. */}
          {achievedPct != null && (
            <div className="px-3 pt-3 pb-2.5 border-t border-border/40">
              <ProgressBar pct={achievedPct} tone={tone} />
            </div>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/* ─────────── Helpers ─────────── */

type Tone = "positive" | "negative" | "neutral";

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

const TONE_BAR: Record<Tone, string> = {
  positive: "bg-gradient-to-r from-emerald-500 to-emerald-400",
  neutral: "bg-gradient-to-r from-slate-500 to-slate-400",
  negative: "bg-gradient-to-r from-rose-600 to-rose-400",
};

const TONE_CHIP: Record<Tone, string> = {
  positive: "bg-emerald-500/15 text-emerald-700",
  neutral: "bg-slate-500/15 text-slate-700",
  negative: "bg-rose-500/15 text-rose-700",
};

function ProgressBar({ pct, tone }: { pct: number; tone: Tone }) {
  const clamped = Math.max(0, Math.min(150, pct));
  const fill = (clamped / 150) * 100; // map 0-150% domain into 0-100% width
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex-1 h-2.5 rounded-full bg-foreground/[0.08] ring-1 ring-foreground/10 overflow-hidden"
        style={{ boxShadow: "inset 0 1px 2px 0 rgba(15,23,42,0.08)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={150}
        aria-valuenow={Math.round(pct)}
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-500",
            TONE_BAR[tone]
          )}
          style={{
            width: `${fill}%`,
            boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.35)",
          }}
        />
        {/* 100% mark — visual reference for "hit estimate exactly". */}
        <span
          aria-hidden
          className="absolute top-0 bottom-0 w-px bg-foreground/30"
          style={{ left: `${(100 / 150) * 100}%` }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-sm",
          TONE_CHIP[tone]
        )}
      >
        %{pct.toFixed(1)}
      </span>
    </div>
  );
}


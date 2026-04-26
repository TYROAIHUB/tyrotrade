import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Wallet01Icon } from "@hugeicons/core-free-icons";
import { BentoTile } from "../BentoTile";
import { AnimatedNumber } from "../AnimatedNumber";
import { formatCompactCurrency } from "@/lib/format";
import { readCache } from "@/lib/storage/entityCache";
import type { Project } from "@/lib/dataverse/entities";

interface BudgetPulseTileProps {
  projects: Project[];
  span?: string;
  rowSpan?: string;
}

/**
 * Filtered-projects month-based realised-sales vs segment-budget pulse.
 *
 * Walks the (projid, invoicedate) aggregate cache and, for each row whose
 * project is in the dashboard's filtered scope:
 *   - Adds the invoiced amount to "totalSales".
 *   - Adds the segment budget for that (project.segment, year-month)
 *     once — deduped across projects so two projects sharing the same
 *     segment + month don't double-count the segment-wide budget.
 *
 * Net effect: "for the months the visible projects actually billed in,
 * how much of those segments' monthly sales targets did we realise?"
 */
export function BudgetPulseTile({
  projects,
  span,
  rowSpan,
}: BudgetPulseTileProps) {
  const reduceMotion = useReducedMotion();

  const { totalSales, totalBudget, ratio, monthsCount, projectsBilled } =
    React.useMemo(() => {
      // Lookup of in-scope projects: projid → segment.
      const projectSegment = new Map<string, string | null>();
      for (const p of projects) projectSegment.set(p.projectNo, p.segment ?? null);

      const salesCache = readCache<Record<string, unknown>>(
        "salesByProjectMonth"
      );
      const budgetCache = readCache<Record<string, unknown>>(
        "mserp_tryaiprojectbudgetlineentities"
      );

      // Pre-built (segment, year-month) → amount lookup so each invoice
      // row resolves to its segment's monthly budget in O(1).
      const budgetByKey = new Map<string, number>();
      for (const r of budgetCache?.value ?? []) {
        const seg = String(r["mserp_segment"] ?? "");
        if (!seg) continue;
        const yearRaw = r["mserp_year"];
        if (typeof yearRaw !== "string") continue;
        const m = yearRaw.match(/^(\d{4})-(\d{2})/);
        if (!m) continue;
        const key = `${seg}|${m[1]}-${m[2]}`;
        const amount = Number(r["mserp_amount"]);
        if (!Number.isFinite(amount)) continue;
        budgetByKey.set(key, (budgetByKey.get(key) ?? 0) + amount);
      }

      // Walk raw USD invoice rows.
      let totalSales = 0;
      let totalBudget = 0;
      const seenBudgetKeys = new Set<string>();
      const seenMonths = new Set<string>();
      const seenProjects = new Set<string>();

      for (const r of salesCache?.value ?? []) {
        const projid = String(r["mserp_etgtryprojid"] ?? "");
        if (!projectSegment.has(projid)) continue; // Out of dashboard scope
        const dateRaw = r["mserp_invoicedate"];
        if (typeof dateRaw !== "string") continue;
        const m = dateRaw.match(/^(\d{4})-(\d{2})/);
        if (!m) continue;
        const ymKey = `${m[1]}-${m[2]}`;
        const amount = Number(r["mserp_lineamount"]);
        if (!Number.isFinite(amount) || amount <= 0) continue;

        totalSales += amount;
        seenMonths.add(ymKey);
        seenProjects.add(projid);

        const segment = projectSegment.get(projid);
        if (segment) {
          const budgetKey = `${segment}|${ymKey}`;
          // Each (segment, month) budget counted once even if multiple
          // projects in that segment billed that month.
          if (!seenBudgetKeys.has(budgetKey)) {
            seenBudgetKeys.add(budgetKey);
            totalBudget += budgetByKey.get(budgetKey) ?? 0;
          }
        }
      }

      const ratio = totalBudget > 0 ? totalSales / totalBudget : 0;
      return {
        totalSales,
        totalBudget,
        ratio,
        monthsCount: seenMonths.size,
        projectsBilled: seenProjects.size,
      };
    }, [projects]);

  const ratioPct = ratio * 100;
  const overBudget = ratioPct >= 100;

  return (
    <BentoTile
      title="Satış Bütçesi Nabzı"
      subtitle={
        totalBudget > 0
          ? `${formatCompactCurrency(totalSales, "USD")} / ${formatCompactCurrency(totalBudget, "USD")}`
          : projectsBilled > 0
            ? `${formatCompactCurrency(totalSales, "USD")} faturalı satış`
            : "Henüz satış yok"
      }
      icon={Wallet01Icon}
      iconColor={overBudget ? "#10b981" : "#0ea5e9"}
      span={span}
      rowSpan={rowSpan}
    >
      <div className="flex flex-col gap-2 h-full">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-[32px] font-semibold leading-none tracking-tight"
            style={{ color: overBudget ? "#047857" : "#0369a1" }}
          >
            <AnimatedNumber
              value={totalSales}
              preset="currency"
              currency="USD"
            />
          </span>
          {totalBudget > 0 && (
            <span
              className="text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md"
              style={{
                color: overBudget ? "#047857" : "#0369a1",
                backgroundColor: overBudget
                  ? "rgba(16,185,129,0.10)"
                  : "rgba(14,165,233,0.10)",
              }}
            >
              %{ratioPct.toFixed(1)}
            </span>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-1.5">
          <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-foreground/[0.06]">
            <motion.div
              initial={
                reduceMotion
                  ? { width: `${Math.min(100, ratioPct)}%` }
                  : { width: 0 }
              }
              animate={{ width: `${Math.min(100, ratioPct)}%` }}
              transition={{
                duration: 0.7,
                delay: 0.15,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="absolute top-0 left-0 h-full rounded-full"
              style={{
                background: overBudget
                  ? "linear-gradient(90deg, #10b981, #34d399)"
                  : "linear-gradient(90deg, #0ea5e9, #38bdf8)",
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {projectsBilled} proje · {monthsCount} ay
            </span>
            <span className="font-medium">
              {totalBudget > 0
                ? `${formatCompactCurrency(totalBudget, "USD")} bütçe`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </BentoTile>
  );
}

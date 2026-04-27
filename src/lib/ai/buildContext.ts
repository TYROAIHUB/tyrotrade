import {
  aggregateAvgTransitDays,
  aggregateByCorridor,
  aggregateBySegment,
  aggregateCargoValueUsd,
  aggregateCounterpartyMix,
  aggregateCurrencyExposure,
  aggregateEstimatedPL,
  aggregateInTransitKg,
  aggregateMarginDistribution,
  topByCargoValue,
  topByMargin,
  topBySalesActual,
} from "@/lib/selectors/aggregate";
import { selectCargoValueUsd, selectStage } from "@/lib/selectors/project";
import { selectProjectPL } from "@/lib/selectors/profitLoss";
import { getFinancialYear } from "@/lib/dashboard/financialPeriod";
import { formatCompactCurrency, formatTons } from "@/lib/format";
import type { Project } from "@/lib/dataverse/entities";

/**
 * Serialize the active project set into a compact Turkish summary that
 * Gemini can quote directly when answering. Output stays well under 4K
 * tokens (target ~1500) so the model has plenty of headroom for the
 * user prompt + system instruction + its own response.
 *
 * The bundle is intentionally redundant in places (totals + ratios +
 * named examples) — small LLMs answer numeric questions much more
 * reliably when both the headline number AND its components are
 * spelled out.
 */
export function buildDashboardContext(
  projects: Project[],
  now: Date = new Date()
): string {
  const fy = getFinancialYear(now);
  const totalProjects = projects.length;

  if (totalProjects === 0) {
    return `=== TYRO INTERNATIONAL TRADE — VERİ ÖZETİ ===
Tarih: ${formatDayMonth(now)}
Filtre kapsamı: 0 proje
NOT: Şu anki filtre boş bir set döndürdü. Sağ üstteki Filtre seçimini gevşet ve tekrar dene.`;
  }

  // Totals
  const totalCargoUsd = aggregateCargoValueUsd(projects);
  const inTransit = aggregateInTransitKg(projects, now);
  const pl = aggregateEstimatedPL(projects);
  const marginDist = aggregateMarginDistribution(projects);
  const currency = aggregateCurrencyExposure(projects);
  const corridors = aggregateByCorridor(projects);
  const counterparty = aggregateCounterpartyMix(projects);
  const velocity = aggregateAvgTransitDays(projects);
  const segments = aggregateBySegment(projects);

  // Pipeline counts — group by raw vesselStatus key
  const pipelineCounts = new Map<string, number>();
  let pipelineTotal = 0;
  for (const p of projects) {
    const vs = p.vesselPlan?.vesselStatus;
    if (!vs) continue;
    pipelineCounts.set(vs, (pipelineCounts.get(vs) ?? 0) + 1);
    pipelineTotal++;
  }
  const pipelineLine = [
    "Commenced",
    "Completed",
    "Closed",
    "Nominated",
    "To Be Nominated",
    "Cancelled",
  ]
    .map((k) => `${k}: ${pipelineCounts.get(k) ?? 0}`)
    .join(" · ");

  // Top 5 projects by cargo value
  const top5Value = topByCargoValue(projects, 5)
    .map((p, i) => {
      const route =
        p.vesselPlan?.loadingPort?.name && p.vesselPlan?.dischargePort?.name
          ? `${p.vesselPlan.loadingPort.name} → ${p.vesselPlan.dischargePort.name}`
          : "Rota yok";
      return `${i + 1}. ${p.projectNo} — ${truncate(p.projectName, 60)} · ${formatCompactCurrency(p.cargoValueUsd, "USD")} · ${route}`;
    })
    .join("\n");

  // Top 3 lowest margin (risk)
  const top3LowestMargin = topByMargin(projects, 3, "asc")
    .map((p, i) => {
      const sign = p.marginPct >= 0 ? "+" : "";
      return `${i + 1}. ${p.projectNo} — ${truncate(p.projectName, 50)} · marj ${sign}${p.marginPct.toFixed(1)}% · K&Z ${formatCompactCurrency(p.pl, "USD")}`;
    })
    .join("\n");

  // Top 3 highest margin
  const top3HighestMargin = topByMargin(projects, 3, "desc")
    .map((p, i) => {
      const sign = p.marginPct >= 0 ? "+" : "";
      return `${i + 1}. ${p.projectNo} — ${truncate(p.projectName, 50)} · marj ${sign}${p.marginPct.toFixed(1)}%`;
    })
    .join("\n");

  // Top 3 sales actual
  const top3SalesActual = topBySalesActual(projects, 3)
    .map(
      (p, i) =>
        `${i + 1}. ${p.projectNo} — ${truncate(p.projectName, 50)} · ${formatCompactCurrency(p.salesActualUsd, "USD")}`
    )
    .join("\n");

  // Top 5 corridors
  const top5Corridors = corridors
    .slice(0, 5)
    .map(
      (c, i) =>
        `${i + 1}. ${c.loadingPort} → ${c.dischargePort} — ${c.count} proje · ${formatCompactCurrency(c.totalCargoValueUsd, "USD")}`
    )
    .join("\n");
  // Corridor HHI
  const corridorTotal = corridors.reduce((s, c) => s + c.count, 0);
  const corridorHhi =
    corridorTotal === 0
      ? 0
      : corridors.reduce(
          (s, c) => s + Math.pow(c.count / corridorTotal, 2),
          0
        );

  // Top 3 segments by P&L
  const top3SegmentsByPL = [...segments]
    .sort((a, b) => b.pl - a.pl)
    .slice(0, 3)
    .map((s, i) => {
      const sign = (s.marginPct ?? 0) >= 0 ? "+" : "";
      return `${i + 1}. ${s.segment} — ${s.projectCount} proje · K&Z ${formatCompactCurrency(s.pl, "USD")} · marj ${sign}${(s.marginPct ?? 0).toFixed(1)}%`;
    })
    .join("\n");

  // Suppliers / buyers top 3
  const top3Suppliers = counterparty.suppliers
    .slice(0, 3)
    .map(
      (r, i) =>
        `${i + 1}. ${truncate(r.name, 60)} — ${r.count} proje · ${formatCompactCurrency(r.totalCargoValueUsd, "USD")}`
    )
    .join("\n");
  const top3Buyers = counterparty.buyers
    .slice(0, 3)
    .map(
      (r, i) =>
        `${i + 1}. ${truncate(r.name, 60)} — ${r.count} proje · ${formatCompactCurrency(r.totalCargoValueUsd, "USD")}`
    )
    .join("\n");

  // Stage distribution
  const stageCounts = countByStage(projects, now);

  // Currency lines
  const currencyLines = (["USD", "EUR", "TRY", "OTHER"] as const)
    .map((c) => {
      const cnt = currency.byCurrency[c].count;
      if (cnt === 0) return null;
      const pct =
        currency.totalProjects > 0
          ? ((cnt / currency.totalProjects) * 100).toFixed(0)
          : "0";
      return `${c}: ${cnt} proje (%${pct})`;
    })
    .filter(Boolean)
    .join(" · ");

  return `=== TYRO INTERNATIONAL TRADE — VERİ ÖZETİ ===
Tarih: ${formatDayMonth(now)}
Filtre kapsamı: ${totalProjects} proje · Finansal yıl: ${fy.fullLabel}

PORTFÖY
─ Toplam proje: ${totalProjects}
─ Toplam kargo değeri: ${formatCompactCurrency(totalCargoUsd, "USD")}
─ Aktif yolculukta tonaj: ${formatTons(inTransit.kg)} (${inTransit.projectCount} proje)
─ USD eşdeğeri P&L katkısı (priced lines): ${pl.contributingCount} proje${
    pl.fxConvertedCount > 0
      ? ` (${pl.fxConvertedCount} tanesi FX dönüşümlü)`
      : ""
  }

K&Z (USD eşdeğeri, statik FX kurları)
─ Tahmini Satış: ${formatCompactCurrency(pl.salesTotalUsd, "USD")}
─ Tahmini Alım: ${formatCompactCurrency(pl.purchaseTotalUsd, "USD")}
─ Tahmini Gider: ${formatCompactCurrency(pl.expenseTotalUsd, "USD")}
─ Net K&Z: ${pl.pl >= 0 ? "+" : ""}${formatCompactCurrency(pl.pl, "USD")}
─ Marj: ${pl.marginPct >= 0 ? "+" : ""}${pl.marginPct.toFixed(1)}%

MARJ DAĞILIMI
─ Sağlıklı (>%5): ${marginDist.positive} proje
─ Marjinal (-%5..%5): ${marginDist.marginal} proje
─ Zararlı (<-%5): ${marginDist.negative} proje
─ Marj hesaplanamaz: ${marginDist.unknown} proje

PIPELINE (voyage durumu — toplam ${pipelineTotal} gemi planlı proje)
${pipelineLine}

VOYAGE STAGE (operasyonel evre)
─ Pre-loading: ${stageCounts["pre-loading"]}
─ Yükleme limanında: ${stageCounts["at-loading-port"]}
─ Yükleme: ${stageCounts.loading}
─ Yolda: ${stageCounts["in-transit"]}
─ Tahliye limanında: ${stageCounts["at-discharge-port"]}
─ Tahliye edildi: ${stageCounts.discharged}
─ Gemi planı yok: ${stageCounts.unscheduled}

PARA BİRİMİ MARUZİYETİ
${currencyLines}
─ Dominant: ${currency.dominant} · HHI: ${currency.hhi.toFixed(2)} (<0.15 sağlıklı, >0.25 yoğun)

ORTALAMA TRANSİT
${
  velocity.sampleSize > 0
    ? `─ Ortalama: ${Math.round(velocity.avgDays)} gün (min ${Math.round(velocity.minDays)}, max ${Math.round(velocity.maxDays)}, ${velocity.sampleSize} sefer örneklemde)`
    : "─ Yeterli LP-(ED)/DP-ETA tarihi yok, ortalama hesaplanamadı"
}

EN BÜYÜK 5 PROJE (kargo değerine göre)
${top5Value || "(veri yok)"}

EN ÇOK FATURALI 3 PROJE (gerçekleşen satış USD)
${top3SalesActual || "(faturalı satış kaydı yok)"}

EN DÜŞÜK MARJLI 3 PROJE (riskli)
${top3LowestMargin || "(marj hesaplanabilir proje yok)"}

EN YÜKSEK MARJLI 3 PROJE
${top3HighestMargin || "(marj hesaplanabilir proje yok)"}

EN AKTİF 5 KORİDOR
${top5Corridors || "(rota verisi yok)"}
─ Koridor HHI: ${corridorHhi.toFixed(2)}

EN BÜYÜK 3 TEDARİKÇİ (proje sayısı)
${top3Suppliers || "(tedarikçi verisi yok)"}
─ Tedarikçi HHI: ${counterparty.supplierHHI.toFixed(2)}

EN BÜYÜK 3 ALICI (proje sayısı)
${top3Buyers || "(alıcı verisi yok)"}
─ Alıcı HHI: ${counterparty.buyerHHI.toFixed(2)}

EN BÜYÜK 3 SEGMENT (K&Z)
${top3SegmentsByPL || "(segment verisi yok)"}

NOT: Yukarıdaki tüm sayılar kullanıcının sağ üstteki Filtre'de seçtiği projelerin alt kümesinde hesaplandı. "Tüm portföy" sorulursa filtreyi gevşetmesi gerekebilir.`;
}

/* ─────────── helpers ─────────── */

function truncate(s: string, max: number): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function formatDayMonth(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function countByStage(
  projects: Project[],
  now: Date
): Record<
  | "pre-loading"
  | "at-loading-port"
  | "loading"
  | "in-transit"
  | "at-discharge-port"
  | "discharged"
  | "unscheduled",
  number
> {
  const out = {
    "pre-loading": 0,
    "at-loading-port": 0,
    loading: 0,
    "in-transit": 0,
    "at-discharge-port": 0,
    discharged: 0,
    unscheduled: 0,
  };
  for (const p of projects) {
    const stage = selectStage(p, now);
    if (stage === null) out.unscheduled++;
    else out[stage]++;
  }
  return out;
}

// Re-export so callers don't need to chase down two helpers
export { selectCargoValueUsd, selectProjectPL };

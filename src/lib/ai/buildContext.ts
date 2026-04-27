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
 * Gemini can use to answer questions about specific vessels, projects,
 * segments, statuses, and time windows.
 *
 * Sections:
 *   1. Headline portfolio + K&Z (rolled-up KPIs)
 *   2. Pipeline / voyage stage / currency / velocity
 *   3. Top-N rankings (value, sales actual, margin↑↓, corridors,
 *      counterparties, segments)
 *   4. PROJECTS DIRECTORY — one line per project with the searchable
 *      handles (projectNo, projectName, vessel, status, route, marj)
 *      so the model can resolve subject-matching queries
 *   5. ACTIVE VOYAGES — Commenced projects with their next milestone
 *   6. UPCOMING MILESTONES — projects with milestones due in the next
 *      14 days, useful for "bu hafta tahliye" / "yarın yükleme" queries
 *
 * Gemini 2.5 Flash supports a 1M-token window so we don't need to
 * trim aggressively, but keep redundancy out of the directory rows
 * so the user can scroll the prompt without slogging.
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

  // PROJECTS DIRECTORY — one line per project, used by Gemini to
  // resolve subject-matching queries (vessel name, projectNo, segment).
  const directory = buildProjectDirectory(projects);

  // ACTIVE VOYAGES — Commenced ships only, with their next milestone
  const activeVoyages = buildActiveVoyages(projects, now);

  // UPCOMING MILESTONES — anything due in the next 14 days
  const upcoming = buildUpcomingMilestones(projects, now);

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

═══ AKTİF SEFERLER (Commenced — şu an yolda/yüklemede/tahliyede) ═══
${activeVoyages || "(şu anda Commenced statüde proje yok)"}

═══ YAKLAŞAN MILESTONE'LAR (önümüzdeki 14 gün) ═══
${upcoming || "(önümüzdeki 14 gün içinde planlı milestone yok)"}

═══ PROJELER DİZİNİ (her satırda 1 proje — vessel/projectNo/segment ile arama yap) ═══
${directory}

NOT: Yukarıdaki tüm sayılar kullanıcının sağ üstteki Filtre'de seçtiği projelerin alt kümesinde hesaplandı. "Tüm portföy" sorulursa filtreyi gevşetmesi gerekebilir.`;
}

/* ─────────── Projects directory ─────────── */

/**
 * One compact line per project. Format:
 *   [PRJ000002443] 55KMT BRZ SOYBEAN | Vessel: XIN HAI TONG 29 (Commenced) |
 *     Santarem→Umm Qasr | Seg: International | Sup: BTG · Buy: SAMA |
 *     Marj +8.4% · K&Z $1.2M
 *
 * The model uses these rows to resolve a query like "XIN HAI TONG 29 hangi
 * projede?" by matching the vessel name in this directory and reading the
 * corresponding projectNo + status. Same goes for projectName, supplier,
 * buyer, segment, route. Truncation is conservative (60 chars on the
 * project name) so most names survive intact.
 */
function buildProjectDirectory(projects: Project[]): string {
  const lines: string[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    const vessel = vp?.vesselName?.trim()
      ? `${vp.vesselName}${vp.vesselStatus ? ` (${vp.vesselStatus})` : ""}`
      : "Vessel: —";
    const route =
      vp?.loadingPort?.name && vp?.dischargePort?.name
        ? `${vp.loadingPort.name}→${vp.dischargePort.name}`
        : "Rota: —";
    const supplier = vp?.supplier?.trim() || "—";
    const buyer = vp?.buyer?.trim() || "—";
    const seg = (p.segment ?? "").trim() || "—";
    const grp = (p.projectGroup ?? "").trim() || "—";
    const cargoProduct = vp?.cargoProduct?.trim() || "—";

    const pl = selectProjectPL(p);
    const margin =
      pl.marginPct === null
        ? "marj —"
        : `marj ${pl.marginPct >= 0 ? "+" : ""}${pl.marginPct.toFixed(1)}%`;
    const cargoValue = selectCargoValueUsd(p);

    lines.push(
      `[${p.projectNo}] ${truncate(p.projectName, 60)} | Gemi: ${vessel} | ${route} | Ürün: ${cargoProduct} | Seg: ${seg}/${grp} | Sup: ${truncate(supplier, 25)} · Buy: ${truncate(buyer, 25)} | ${margin} · ${formatCompactCurrency(cargoValue, "USD")} · Status: ${p.status}`
    );
  }
  return lines.join("\n");
}

/* ─────────── Active voyages (Commenced) ─────────── */

/**
 * Commenced ships with their *next* milestone (whichever pending date is
 * closest to today). Useful for "şu an yolda olan gemiler" / "hangi
 * gemiler yüklemede" style queries.
 */
function buildActiveVoyages(projects: Project[], now: Date): string {
  const rows: string[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    if (!vp || vp.vesselStatus !== "Commenced") continue;
    const stage = selectStage(p, now);
    const nextMs = nextPendingMilestone(vp.milestones, now);
    const route =
      vp.loadingPort?.name && vp.dischargePort?.name
        ? `${vp.loadingPort.name}→${vp.dischargePort.name}`
        : "—";
    rows.push(
      `[${p.projectNo}] ${truncate(p.projectName, 50)} | Gemi: ${vp.vesselName} | ${route} | Stage: ${stage ?? "—"}${nextMs ? ` | Sonraki: ${nextMs.label} ${formatDate(nextMs.date)}` : ""}`
    );
  }
  return rows.join("\n");
}

/* ─────────── Upcoming milestones (next 14 days) ─────────── */

const MILESTONE_LABELS: Record<keyof import("@/lib/dataverse/entities").VesselMilestones, string> = {
  lpEta: "LP-ETA (yükleme limanına varış)",
  lpNorAccepted: "LP-NOR Kabul",
  lpSd: "Yükleme başlangıcı",
  lpEd: "Yükleme bitişi",
  blDate: "BL düzenleme",
  dpEta: "DP-ETA (varış tahminleri)",
  dpNorAccepted: "DP-NOR Kabul",
  dpSd: "Tahliye başlangıcı",
  dpEd: "Tahliye bitişi",
};

interface UpcomingRow {
  projectNo: string;
  projectName: string;
  vessel: string;
  label: string;
  date: Date;
  daysFromNow: number;
}

function buildUpcomingMilestones(projects: Project[], now: Date): string {
  const horizon = now.getTime() + 14 * 24 * 60 * 60 * 1000;
  const rows: UpcomingRow[] = [];
  for (const p of projects) {
    const vp = p.vesselPlan;
    if (!vp) continue;
    const ms = vp.milestones;
    for (const key of Object.keys(MILESTONE_LABELS) as Array<
      keyof typeof MILESTONE_LABELS
    >) {
      const iso = ms[key];
      if (!iso) continue;
      const t = new Date(iso);
      if (Number.isNaN(t.getTime())) continue;
      if (t.getTime() < now.getTime() || t.getTime() > horizon) continue;
      const daysFromNow = Math.round(
        (t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      rows.push({
        projectNo: p.projectNo,
        projectName: truncate(p.projectName, 45),
        vessel: vp.vesselName ?? "—",
        label: MILESTONE_LABELS[key],
        date: t,
        daysFromNow,
      });
    }
  }
  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return rows
    .slice(0, 30) // cap so the bundle stays compact
    .map(
      (r) =>
        `${formatDate(r.date)} (+${r.daysFromNow}g) — [${r.projectNo}] ${r.projectName} | Gemi: ${r.vessel} | ${r.label}`
    )
    .join("\n");
}

/* ─────────── helpers ─────────── */

function nextPendingMilestone(
  ms: import("@/lib/dataverse/entities").VesselMilestones,
  now: Date
): { label: string; date: Date } | null {
  let best: { label: string; date: Date } | null = null;
  for (const key of Object.keys(MILESTONE_LABELS) as Array<
    keyof typeof MILESTONE_LABELS
  >) {
    const iso = ms[key];
    if (!iso) continue;
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) continue;
    if (t.getTime() < now.getTime()) continue;
    if (!best || t.getTime() < best.date.getTime()) {
      best = { label: MILESTONE_LABELS[key], date: t };
    }
  }
  return best;
}

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

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "2-digit",
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

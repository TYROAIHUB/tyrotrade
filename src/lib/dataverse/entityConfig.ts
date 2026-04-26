/**
 * Read-only Data Inspector entity catalog.
 *
 * Each entry describes an entity set we can list in the Data Management
 * page. Field names are NOT pre-declared — we discover them by fetching
 * actual rows and inspecting the response.
 */

export interface InspectorEntityConfig {
  /** Internal key (also used in URL: /data/:key) */
  key: string;
  /** Tab/title shown to the user */
  label: string;
  /** Brief one-line description */
  description: string;
  /** Dataverse entity set name (the URL path segment) */
  entitySet: string;
  /** Default $filter applied on fetch (optional). */
  defaultFilter?: () => string | undefined;
  /** Hint text shown above the table */
  hint?: string;
}

const traderFilter = import.meta.env.VITE_PROJECT_TRADER_FILTER;

export const INSPECTOR_ENTITIES: InspectorEntityConfig[] = [
  {
    key: "projects",
    label: "Projeler",
    description: "Proje header tablosu (mserp_etgtryprojecttableentities)",
    entitySet: "mserp_etgtryprojecttableentities",
    defaultFilter: () =>
      traderFilter
        ? `mserp_maintraderid eq '${traderFilter}'`
        : undefined,
    hint: traderFilter
      ? `Sadece mserp_maintraderid='${traderFilter}' filtreli sonuçlar geliyor (440 proje).`
      : undefined,
  },
  {
    key: "project-ship",
    label: "Proje-Gemi Planı",
    description:
      "Proje-Gemi ilişkisi (mserp_tryaiprojectshiprelationentities) — projectId üzerinden",
    entitySet: "mserp_tryaiprojectshiprelationentities",
    hint:
      "Tüm satırlar çekilir; üst projelerle eşleştirme client tarafında yapılır (alan adlarını gördükten sonra).",
  },
  {
    key: "project-lines",
    label: "Proje Satırları",
    description:
      "Proje line items (mserp_tryaiprojectlineentities) — projectId üzerinden",
    entitySet: "mserp_tryaiprojectlineentities",
  },
  {
    key: "expense-lines",
    label: "Tahmini Gider Satırları",
    description:
      "Other expense satırları (mserp_tryaiotherexpenseentities) — projectId (mserp_etgtryprojid) üzerinden",
    entitySet: "mserp_tryaiotherexpenseentities",
  },
  {
    key: "budget-lines",
    label: "Tahmini Bütçe (Segment)",
    description:
      "Segment-bazlı bütçe (mserp_tryaiprojectbudgetlineentities) — segment üzerinden",
    entitySet: "mserp_tryaiprojectbudgetlineentities",
  },
];

export function findEntityConfig(key: string): InspectorEntityConfig | undefined {
  return INSPECTOR_ENTITIES.find((e) => e.key === key);
}

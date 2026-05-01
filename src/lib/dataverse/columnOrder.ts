/**
 * Best-practice column ordering per entity for the Data Inspector.
 *
 * Tables auto-discover their columns from the data, but the natural insertion
 * order from JSON keys is unpredictable. This module declares "priority" lists
 * — the most operationally important fields first. Fields not in the list are
 * appended at the end in discovery order.
 *
 * Used by `EntityRowsTable` via the `priorityColumns` prop.
 */

/** Apply a priority list to a discovered column set:
 *  priority fields (in order) first, remaining fields after in original order. */
export function reorderColumns(
  discovered: string[],
  priority: readonly string[]
): string[] {
  const setDiscovered = new Set(discovered);
  const priorityPresent = priority.filter((k) => setDiscovered.has(k));
  const priorityKnown = new Set(priorityPresent);
  const rest = discovered.filter((k) => !priorityKnown.has(k));
  return [...priorityPresent, ...rest];
}

/* ─────────── Entity-specific priorities ─────────── */

/**
 * mserp_etgtryprojecttableentities — Project header.
 *
 * Only the operationally important fields are listed. Anything from
 * `mserp_isorganic` onwards (option-set flags, financial dimension display
 * values, sub-contract metadata, payment specs) is intentionally omitted —
 * they're rarely useful in a list view, so we neither fetch nor render them.
 */
export const PROJECT_COLUMNS = [
  "mserp_projid",
  "mserp_projname",
  "mserp_projgroupid",
  "mserp_contractdate",
  "mserp_status",
  "mserp_tryprojectsegment",
  "mserp_tryexpenseprojecttype",
  "mserp_traderid",
  "mserp_maintraderid",
  "mserp_currencycode",
  "mserp_dlvmode",
  "mserp_dlvterm",
  "mserp_vendaccount",
] as const;

/** mserp_tryaiprojectlineentities — Project line items */
export const PROJECT_LINE_COLUMNS = [
  "mserp_projid",
  "mserp_itemid",
  "mserp_qty",
  "mserp_unitid",
  "mserp_unitprice",
  "mserp_currencycode",
  "mserp_salesprice",
  "mserp_priceunit",
  "mserp_etgproductlevel01",
  "mserp_etgproductlevel02",
  "mserp_etgproductlevel03",
  "mserp_qualitycategoryid",
  "mserp_startdate",
  "mserp_enddate",
] as const;

/** mserp_tryaiprojectshiprelationentities — Vessel plan + voyage milestones */
export const SHIP_COLUMNS = [
  // Identity
  "mserp_tryshipprojid",
  "mserp_vesselname",
  "mserp_assignmentid",
  "mserp_vesselvoyagenumber",
  "mserp_voyagestatus",
  "mserp_tryshipmentstatus",
  // Cargo
  "mserp_trycargogoods",
  "mserp_cargoquantity",
  "mserp_outturnquantity",
  "mserp_purchqty",
  "mserp_netfreightamount",
  // Ports
  "mserp_tryloadingport",
  "mserp_loadingcountryregionid",
  "mserp_trydischargeport",
  "mserp_dischargecountryregionid",
  // Voyage timeline (chronological)
  "mserp_tryestimatedtimeofdeparture",
  "mserp_tryloadstartdate",
  "mserp_tryloadenddate",
  "mserp_trydeparturedatebl",
  "mserp_tryestimatedtimeofarrival",
  "mserp_arrivaldate",
  "mserp_tryarrivalconfirmdate",
  "mserp_trynoraccepteddate",
  "mserp_trydischargestartdate",
  "mserp_trydischargeenddate",
  "mserp_laycanfrom",
  "mserp_bookingdate",
  // Parties + commercial
  "mserp_charterepartyname",
  "mserp_charterer",
  "mserp_dlvmodeid",
  "mserp_dlvtermid",
  "mserp_paymtermid",
  "mserp_trybuyer",
  "mserp_tryseller",
  "mserp_companyid",
  "mserp_tryprojectsegment",
  // Misc / status
  "mserp_trydescription",
  "mserp_trypaymentstatus",
  // Demurrage — only the 2 free-text "desc" columns exist on
  // `mserp_tryaiprojectshiprelationentities`. The option-set `*reason`
  // and `*reasonexp` columns live on the parent TRYProjectShipRelation
  // table, not the AI variant we read here, so we don't request them.
  "mserp_trydemurragereasondesc",
  "mserp_trydischargedemurragedesc",
  "mserp_loadingtime",
  "mserp_transittime",
  "mserp_evacuationtime",
  "mserp_transfertime",
  "mserp_voyageouttype",
  "mserp_tryexpenseprojecttype",
  "mserp_tryassignmentid",
  "mserp_trylinenum",
  "mserp_paymentsched",
  "mserp_primaryfield",
  // RecID lookups (numeric — least useful for humans, last).
  //
  // ⚠ Each lookup column is paired with its `_bigint` shadow.
  // F&O virtual entities expose these as a pair: when only one half
  // is in $select, Dataverse's metadata resolver may report the
  // friendly name as missing ("Could not find a property named ...")
  // even though both halves are valid together. Empirically, keeping
  // the pair intact is what makes `$select` succeed on this entity.
  // Don't remove `_bigint` columns again unless you've verified the
  // entity schema has decoupled the pair end-to-end.
  "mserp_loadingport",
  "mserp_loadingport_bigint",
  "mserp_dischargeporting",
  "mserp_dischargeporting_bigint",
  "mserp_vessel",
  "mserp_vessel_bigint",
  "mserp_vesseltype",
  "mserp_vesseltype_bigint",
  "mserp_shipoperator",
  "mserp_shipoperator_bigint",
  "mserp_cargogood",
  "mserp_cargogood_bigint",
  "mserp_chartererpartys",
  "mserp_chartererpartys_bigint",
  "mserp_tradedesk",
  "mserp_tradedesk_bigint",
  "mserp_buyerrec",
  "mserp_buyerrec_bigint",
  "mserp_sellerrec",
  "mserp_sellerrec_bigint",
  "mserp_tryaiprojectshiprelationentityid",
] as const;

/** mserp_tryaiotherexpenseentities — Estimated expense lines.
 *  Switched (April 2026) from the legacy `mserp_tryaiotherexpenseprojectline`
 *  variant to this direct expense entity. Project relation is now
 *  `mserp_etgtryprojid` (NOT `mserp_tryplanprojectid`). Trimmed to the 3
 *  fields the user actually consumes:
 *   - Proje No (`mserp_etgtryprojid`)
 *   - Yan masraf türü (`mserp_tryexpensetype`) — F&O numeric code; the
 *     `@FormattedValue` annotation carries the friendly category label
 *     (e.g. "Operasyonel giderler") when set.
 *   - Tahmini Birim Fiyat USD (`mserp_expamountusdd`)
 *  Composer groups rows by `mserp_tryexpensetype` so the right-panel
 *  EstimatedExpenseCard summarises by expense type. */
export const EXPENSE_COLUMNS = [
  "mserp_etgtryprojid",
  "mserp_tryexpensetype",
  "mserp_expamountusdd",
] as const;

/** mserp_tryaicustinvoicetransentities — Customer invoice transactions
 *  (actual posted invoices, not sales-order projections). Linked to
 *  projects via `etgtryprojid`. Per-project fetch ordered by invoice date
 *  desc, top N. Used as a child tab in the Projeler view to show the
 *  most recent realised sales for budget-vs-actual.
 *
 *  Field names verified against a live response: quantity is `mserp_qty`,
 *  customer name is `mserp_salesname`, item display name is `mserp_name`,
 *  invoice number is `mserp_invoiceid`, invoice date is `mserp_invoicedate`,
 *  source sales order is `mserp_salesid`. */
export const SALES_COLUMNS = [
  "mserp_etgtryprojid",
  "mserp_etgtraderid",
  "mserp_invoiceid",
  "mserp_invoicedate",
  "mserp_salesid",
  "mserp_salesname",
  "mserp_itemid",
  "mserp_name",
  "mserp_qty",
  "mserp_salesprice",
  "mserp_lineamount",
  "mserp_currencycode",
  "mserp_dlvdate",
] as const;

/** mserp_tryaiprojectbudgetlineentities — Segment-based budgets */
export const BUDGET_COLUMNS = [
  "mserp_segment",
  "mserp_year",
  "mserp_projectexpenseid",
  "mserp_amount",
  "mserp_qty",
] as const;

/** mserp_tryaifrtexpenselinedistlineentities — Realised (actual) expense
 *  distribution lines. New entity supplied by the F&O team for
 *  "Gerçekleşen Gider Satırları". Project FK = `mserp_etgtryprojid`,
 *  matches the same convention as `mserp_tryaiotherexpenseentities`.
 *
 *  Operationally relevant fields, confirmed by the user:
 *   - `mserp_etgtryprojid` — project FK (joins to Projeler)
 *   - `mserp_datefinancial` — financial posting date
 *   - `mserp_expensenum` — expense voucher number
 *   - `mserp_dataareaid` — F&O legal entity / company code
 *   - `mserp_expenseid` — expense category id
 *   - `mserp_qty` — booked quantity
 *   - `mserp_lineamount` — booked amount in the row's currency
 *   - `mserp_currencycode` — currency of `mserp_lineamount`
 *   - `mserp_etgtraderid` — trader the cost is allocated to
 *   - `mserp_itemname` — line item / cargo description
 *
 *  Fetched with `$select` so the payload (and localStorage cache) stays
 *  small; rendered with explicit `columns={[...ACTUAL_EXPENSE_COLUMNS]}`
 *  so the inspector hides anything else that may already be cached. */
export const ACTUAL_EXPENSE_COLUMNS = [
  "mserp_etgtryprojid",
  "mserp_datefinancial",
  "mserp_expensenum",
  "mserp_dataareaid",
  "mserp_expenseid",
  "mserp_qty",
  "mserp_lineamount",
  "mserp_currencycode",
  "mserp_etgtraderid",
  "mserp_itemname",
] as const;

/** mserp_tryaivendinvoicetransentities — Realised (actual) project
 *  purchases. Vendor invoice transactions linked to a project line
 *  (counterpart of `mserp_tryaicustinvoicetransentities` for sales).
 *
 *  Project FK = `mserp_purchtable_etgtryprojid` (note the
 *  `purchtable_` prefix — different from the standard
 *  `mserp_etgtryprojid` other entities use; the FK lives on the
 *  parent purchase table, exposed here as a flattened column).
 *
 *  Operationally relevant fields, confirmed by the user:
 *   - `mserp_purchtable_etgtryprojid` — project FK (joins to Projeler)
 *   - `mserp_purchid` — purchase voucher / order number
 *   - `mserp_purchtable_etgtraderid` — operational trader on the PO
 *   - `mserp_purchtable_etgmaintraderid` — main / desk-leader trader
 *   - `mserp_invoicedate` — vendor invoice date
 *   - `mserp_purchtable_purchname` — purchase order title / vendor desc
 *   - `mserp_itemid` — item code
 *   - `mserp_name` — item display name
 *   - `mserp_qty` — invoiced quantity
 *   - `mserp_purchprice` — unit purchase price (in row currency)
 *   - `mserp_lineamount` — line total in row currency
 *   - `mserp_currencycode` — currency of `mserp_lineamount`/`mserp_purchprice`
 *
 *  Fetched with `$select` to keep the payload + cache lean; rendered
 *  with explicit `columns={[...PURCHASE_COLUMNS]}` so only these
 *  fields surface in the inspector. */
export const PURCHASE_COLUMNS = [
  "mserp_purchtable_etgtryprojid",
  "mserp_purchid",
  "mserp_purchtable_etgtraderid",
  "mserp_purchtable_etgmaintraderid",
  "mserp_invoicedate",
  "mserp_purchtable_purchname",
  "mserp_itemid",
  "mserp_name",
  "mserp_qty",
  "mserp_purchprice",
  "mserp_lineamount",
  "mserp_currencycode",
] as const;

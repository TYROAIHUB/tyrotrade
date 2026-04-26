# Dataverse Schema Reference (Tiryaki F&O dual-write)

> 🔒 **Read-only** — all entity sets accessed via GET only. Discovery captured from live tenant `https://operations-tiryaki.crm4.dynamics.com/api/data/v9.2/` on 2026-04-25 with token (TRD-FTB scope).

## Filter

- **TRD-FTB project count**: **440**
- Filter expr: `mserp_maintraderid eq 'TRD-FTB'`
- Apply on: `mserp_etgtryprojecttableentities` only (other tables join via project ID)

## Headers required

```
Authorization: Bearer <MSAL token (Dynamics CRM user_impersonation)>
OData-MaxVersion: 4.0
OData-Version: 4.0
Accept: application/json
Prefer: odata.include-annotations="*"
```

The `Prefer` header surfaces option-set codes as human strings via `@OData.Community.Display.V1.FormattedValue` annotations:
- `mserp_status: 200000000` → "Open"
- `mserp_workflowstatus: 200000005` → "Not submitted"
- `mserp_isorganic: 200000000` → "No"

## 1. Projects — `mserp_etgtryprojecttableentities`

**Primary key**: `mserp_etgtryprojecttableentityid` (GUID)
**Business key**: `mserp_projid` (e.g. `"MESTHL00368"`, `"PRJ000001766"`, `"THYTHL00011"`)

| Field | Type | Sample | Notes |
|---|---|---|---|
| `mserp_projid` | string | `MESTHL00368` | Business key, FK target for child tables |
| `mserp_projname` | string | `RED SEA - 30.000MT SORGHUM - APR '21 - MV WL LADOGA` | Free-text title |
| `mserp_maintraderid` | string | `TRD-FTB` | **Filter field** |
| `mserp_traderid` | string | `TRD-FTB` | |
| `mserp_projgroupid` | string | `TAHIL` \| `YAGLITOHUM` | |
| `mserp_currencycode` | string | `USD` \| `EUR` \| `TRY` | |
| `mserp_dlvmode` | string | `Gemi` \| `Kara` | Transport mode |
| `mserp_dlvterm` | string | `FOB` \| `CIF` \| `MUS_DP_TES` | Incoterm |
| `mserp_contractdate` | ISO date | `2021-03-08T00:00:00Z` | Project date |
| `mserp_status` | option set | `200000000` → `"Open"` | |
| `mserp_workflowstatus` | option set | `200000005` → `"Not submitted"` | |
| `mserp_isorganic` | option set | `200000000` → `"No"` | |
| `mserp_tryprojectsegment` | string | `""` (often empty) | Segment label |
| `mserp_projtradetypeid` | string | `TICARET` | |
| `mserp_vendaccount` | string | `C18052` | Counterparty ID |
| `mserp_vendaccountdescription` | string | `RED SEA - 30...` | Counterparty descr |

Total fields: 33

## 2. Project–Ship Relation — `mserp_tryaiprojectshiprelationentities`

**Primary key**: `mserp_tryaiprojectshiprelationentityid` (GUID)
**Foreign key**: `mserp_tryshipprojid` → `Project.mserp_projid`

> Vessel plan + voyage milestones live here. **No separate `lpEta` / `dpEta` columns** — schema uses estimated/actual pairs:

| Field | Type | Sample | Notes |
|---|---|---|---|
| `mserp_tryshipprojid` | string | `PRJ000001766` | **FK to Project** |
| `mserp_assignmentid` | string | `FFIX001015` | Fixture ID |
| `mserp_vesselname` | string | `AMIRA JOY` | |
| `mserp_vesselvoyagenumber` | string | `1` | |
| `mserp_voyagestatus` | option set | `200000003` → label TBD | Vessel status |
| `mserp_tryshipmentstatus` | string | `Discharge process completed.` | Free-text operation status |
| `mserp_trycargogoods` | string | `SOYBEAN` | Cargo product |
| `mserp_cargoquantity` | decimal | `6251.99` | Planned tonnage |
| `mserp_outturnquantity` | decimal | `6252` | Actual tonnage |
| `mserp_purchqty` | decimal | `0` | Purchase qty |
| `mserp_netfreightamount` | decimal | `3032215.15` | Freight USD |
| `mserp_charterepartyname` | string | `FARMFUSION TRADEHOUSE OÜ` | |
| `mserp_charterer` | string | `""` | |
| `mserp_dlvmodeid` | string | `Gemi` | |
| `mserp_dlvtermid` | string | `""` | |
| `mserp_paymtermid` | string | `CAD` | |
| **Ports** | | | |
| `mserp_tryloadingport` | string | `Odesa` | LP name |
| `mserp_loadingcountryregionid` | string | `Ukraine` | LP country |
| `mserp_loadingport` | bigint | `5637144631` | LP RecID |
| `mserp_trydischargeport` | string | `Giresun` | DP name |
| `mserp_dischargecountryregionid` | string | `Turkey` | DP country |
| `mserp_dischargeporting` | bigint | `5637144608` | DP RecID |
| **Voyage timeline** | | | |
| `mserp_tryestimatedtimeofdeparture` | ISO date \| null | `null` | **ETD (planned)** |
| `mserp_tryestimatedtimeofarrival` | ISO date \| null | `2024-12-19` | **ETA (planned)** |
| `mserp_trynoraccepteddate` | ISO date \| null | `2024-12-19` | NOR accepted (single field — no LP/DP split) |
| `mserp_tryloadstartdate` | ISO date \| null | `null` | Loading start |
| `mserp_tryloadenddate` | ISO date \| null | `2025-01-04` | Loading end |
| `mserp_trydeparturedatebl` | ISO date \| null | `2025-01-03` | **BL date / actual departure** |
| `mserp_arrivaldate` | ISO date \| null | `2025-01-06` | **Actual arrival** |
| `mserp_trydischargestartdate` | ISO date \| null | `2025-01-23` | Discharge start |
| `mserp_trydischargeenddate` | ISO date \| null | `2025-01-25` | Discharge end |
| `mserp_tryarrivalconfirmdate` | ISO date \| null | `2025-01-06` | |
| `mserp_laycanfrom` | ISO date \| null | `null` | Laycan window |
| `mserp_bookingdate` | ISO date \| null | `null` | |
| `mserp_departuredate` | ISO date \| null | `null` | |
| **Other** | | | |
| `mserp_companyid` | string | `DTHY` | |
| `mserp_tryprojectsegment` | string | `Tahıl_Operasyon` | Segment (here populated) |
| `mserp_trydescription` | string | `TAHLİYE VE İTHALAT TAMAMLANDI` | Free-text descr |
| `mserp_trypaymentstatus` | string | `TAMAMLANDI` | |
| `mserp_trydischargedemurragedesc` | string | `42827,78 USD` | Demurrage |
| `mserp_trydemurragereason` | option set | `200000000` | |

Total fields: 76

> **Implication for milestone progress logic**: our existing `describeProgress()` expects `lpEta/lpNorAccepted/lpSd/lpEd/blDate/dpEta/dpNorAccepted` — these need **mapping**:
> - `lpEta` → `mserp_tryestimatedtimeofarrival` (estimated arrival at loading port? or destination? clarify with user)
> - `lpNorAccepted` → `mserp_trynoraccepteddate` (single field — no LP/DP split in source; map to lpNorAccepted)
> - `lpSd` → `mserp_tryloadstartdate`
> - `lpEd` → `mserp_tryloadenddate`
> - `blDate` → `mserp_trydeparturedatebl`
> - `dpEta` → `mserp_tryestimatedtimeofarrival` (?)
> - `dpNorAccepted` → no separate field; can derive from `mserp_arrivaldate`

⚠️ **mserp_tryestimatedtimeofarrival** could be either LP-ETA or DP-ETA — **user clarification needed** before milestone mapping.

## 3. Project Lines — `mserp_tryaiprojectlineentities`

**Primary key**: `mserp_tryaiprojectlineentityid` (GUID)
**Foreign key**: `mserp_projid` → `Project.mserp_projid`

| Field | Type | Sample |
|---|---|---|
| `mserp_projid` | string | `THYTHL00011` |
| `mserp_linenum` | int | `1` |
| `mserp_itemid` | string | `314012` (item code, no name) |
| `mserp_qty` | decimal | `3000000` |
| `mserp_unitid` | string | `KG` |
| `mserp_unitprice` | decimal | `562.37` |
| `mserp_currencycode` | string | `TRY` |
| `mserp_etgproductlevel01` | string | `TCR` (Ticaret) |
| `mserp_etgproductlevel02` | string | `BKL` |
| `mserp_etgproductlevel03` | string | `NHT` |
| `mserp_qualitycategoryid` | string | `""` |
| `mserp_salesprice` | decimal | `0` |
| `mserp_priceunit` | decimal | `0` |
| `mserp_overdelivery` | option set | `200000000` → "No" |
| `mserp_startdate`, `mserp_enddate` | ISO date \| null | |

Total fields: 22

> ⚠️ **`productName` field MISSING.** Only `mserp_itemid` (numeric code). Product name will need a separate lookup against an item-master table or derived from `etgproductlevel01/02/03`.

## 4. Other Expense Lines — `mserp_tryaiotherexpenseprojectlineentities`

**Primary key**: `mserp_tryaiotherexpenseprojectlineentityid`
**Foreign key**: `mserp_tryplanprojectid` (or `mserp_etgtryprojid`?) → `Project.mserp_projid`

| Field | Type | Sample | Notes |
|---|---|---|---|
| `mserp_tryplanprojectid` | string | `PRJ000001979` | **FK to Project** (populated) |
| `mserp_etgtryprojid` | string | `""` | Often empty |
| `mserp_tryexpensetype` | string | `721024` | Expense category code |
| `mserp_refexpenseid` | string | `Freight` | Friendly category |
| `mserp_expamountusdd` | decimal | `40.95` | Expense amount in USD |
| `mserp_totalexpectedamount` | decimal | `0` | Total expected |
| `mserp_description` | string | `""` | Free-text |
| `mserp_fob/cif/export/import/domesticpurch/domesticsale/ship/truck/containers` | option sets | `200000000` | Discriminator flags |
| `mserp_refrecid` | int | `5637697327` | RecID reference |

Total fields: 22

## 5. Segment Budget Lines — `mserp_tryaiprojectbudgetlineentities`

**Primary key**: `mserp_tryaiprojectbudgetlineentityid`
**Linked by**: `mserp_segment` (matches `Project.mserp_tryprojectsegment` and `ShipRelation.mserp_tryprojectsegment`)

| Field | Type | Sample |
|---|---|---|
| `mserp_segment` | string | `Central America` |
| `mserp_year` | ISO date | `2023-08-31T00:00:00Z` (period end) |
| `mserp_amount` | decimal | `18000000` |
| `mserp_qty` | int | `18000` |
| `mserp_projectexpenseid` | string | `Sales Budget` |
| `mserp_itemid` | string | `""` |
| `mserp_accountnum` | string | `""` |
| `mserp_namealias` | string | `""` |
| `mserp_custname` | string | `""` |

Total fields: 12

> Period granularity is **a single date** (`mserp_year` ends in dd-MM-yyyy), so it's effectively one row per segment per fiscal period (the "year" might be misnamed — could be quarter-end or month-end). Will see when full data is fetched.

## Resolved questions

1. ✅ **`mserp_tryestimatedtimeofarrival` = DP-ETA** (discharge port arrival). Pair with `mserp_tryestimatedtimeofdeparture` = ETD from loading port. **There is no separate LP-ETA field** — loading-side timing comes from `mserp_tryloadstartdate` / `mserp_tryloadenddate`.
2. ⏳ **Voyage status codes** — pending; for now display raw numeric codes (`200000000`, `200000003`, ...). User will provide mapping later.
3. ⏳ **Product name** — for now we proceed without it; only `mserp_itemid` (numeric code) is rendered. Lookup table TBD.
4. ✅ **OtherExpense FK = `mserp_tryplanprojectid`** (not `mserp_etgtryprojid` — that one is empty in production data).
5. ✅ **`mserp_year` is the fiscal year** (full date represents year-end of the budget period).

## Milestone mapping (for `describeProgress`)

Existing UI expects `lpEta / lpNorAccepted / lpSd / lpEd / blDate / dpEta / dpNorAccepted`. Source mapping:

| UI expects | Source field | Notes |
|---|---|---|
| `lpEta` | _(no source)_ | Skip — derive from loadStartDate or omit |
| `lpNorAccepted` | `mserp_trynoraccepteddate` | Single field — represents either LP or DP NOR. May need user confirmation if both stages need separate tracking. |
| `lpSd` | `mserp_tryloadstartdate` | Loading start |
| `lpEd` | `mserp_tryloadenddate` | Loading end |
| `blDate` | `mserp_trydeparturedatebl` | BL = vessel departure |
| `dpEta` | `mserp_tryestimatedtimeofarrival` | Estimated discharge port arrival |
| `dpNorAccepted` | _(no source)_ | Derive from `mserp_arrivaldate` (actual arrival = effectively "NOR accepted at DP") |

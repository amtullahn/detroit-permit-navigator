# Detroit open-data field verification (checked live, Oct 24 2026)

All datasets are ArcGIS Feature Services under
`https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services/<service>/FeatureServer/0`.
Query pattern: `.../0/query?where=<clause>&outFields=*&returnGeometry=false&f=json`.
Every BSEED dataset carries `parcel_id` and `address_id`, so the join path is:
address → Parcels → `parcel_id` → all other datasets.

## Parcels (Current) — `parcel_file_current` (Office of the Assessor)
Fields used by lookup_parcel: `parcel_id`, `address`, `zoning_district`,
`local_historic_district`, `is_improved`, `num_buildings`, `tax_status`,
`property_class_description`, `use_code_description`, `year_built`,
`neighborhood`, `council_district`, `parcel_modified_date`.
Notes: 58 fields; also holds owner fields (`taxpayer_1` etc.) which the app must
NOT search or display (address/parcel lookups only). `zoning_district` values are
short codes like `R1`, `B4`.

## Base Unit Layers — `BaseUnitFeatures` (layers: 0 Addresses, 1 Streets, 2 Buildings)
Buildings layer: `building_id`, `parcel_id`, `status` (sample value "Current";
also pending/demolished per spec), `also_known_as`. Use `status` for the
"building status" part of lookup_parcel.

## Building Permits — `bseed_building_permits` (BSEED)
Fields: `record_id` (e.g. BLD2022-05795), `address`, `permit_type`,
`work_description`, `submitted_date`, `issued_date`, `zoning_designation`,
`current_use_type`, `proposed_use_type`, `amt_permit_cost`, `parcel_id`.

## Building Permit Plan Reviews — `bseed_building_permit_plan_reviews`
Fields: `task_id`, `record_id` (joins to permit), `task`, `task_status`,
`task_status_date`, `parcel_id`.

## Certificate of Occupancy — `bseed_occupancy_certificates`
Fields: `record_id`, `address`, `task_status` (e.g. "CofO Issued"),
`issued_date`, `use_group`, `current_use_type`, `proposed_use_type`, `parcel_id`.
Records approvals, not current use (spec caveat stands).

## Blight Tickets — `blight_tickets`
Fields: `ticket_id`, `ticket_number`, `address`, `ordinance_description`,
`disposition`, `payment_status`, `amt_balance_due`, `ticket_issued_date`,
`parcel_id`, `address_id`.
"Open ticket" must be derived from `disposition` + `payment_status`
(sample: "Responsible by Default" / "NO PAYMENT APPLIED") — there is no simple
open/closed flag. Confirm the open-ticket rule before coding list_blockers.

## Active Commercial Certificates of Compliance — `bseed_active_commercial_compliance_certificates`
Fields: `record_id`, `address`, `issued_date`, `expired_date`,
`num_days_until_expired`, `parcel_id`. Valid certificates only.

## Active Residential Certificates of Compliance — `bseed_active_residential_compliance_certificates`
Same shape as commercial plus `building_id`.

## Rental Registrations — `bseed_rental_registrations`
Fields: `record_id`, `address`, `issued_date`, `registration_type`, `parcel_id`.

## DLBA Owned Properties — `DLBA_Owned_Properties`
Fields: `name` (address string), `parcel_id`, `inventory_status_socrata`
(e.g. "DLBA Owned Structure"), `neighborhood`, `council_district`.
Caveat: portal record last modified Sep 2024 — ownership may lag sales; label
results with the fetch date and re-check wording.

## Detroit Local Historic Districts — `Detroit_Local_Historic_Districts`
Fields: `Name`, `Section` (ordinance section), `Year_Enacted` (epoch ms),
`Report_Link`, `Interior_Designation`. Polygons only, no parcel key → historic
overlap needs a geometry intersect query OR the simpler `local_historic_district`
field already on Parcels. Prefer the Parcels field; keep this layer for the
district name/report link. Newer than the 2013 compilation in the spec
(portal record modified Sep 2025).

## Not verified yet
- Blight "open" derivation rule (which dispositions count as open).
- Zoning lookup table mapping parcel `zoning_district` codes (R1, B4…) to full
  names for display.
- Update cadence per dataset beyond Parcels (Assessor says checked daily).

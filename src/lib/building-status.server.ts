// Server-only: Detroit open-data adapters for the building_status sync.
// Each dataset is isolated behind its own adapter config so field mappings are easy to change.

const BASE = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services";

export type BuildingStatusValue =
  | "dlba_available"
  | "sold"
  | "pending"
  | "active"
  | "retired"
  | "for_sale_private"
  | "unknown";

export interface SyncRow {
  parcel_id: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: BuildingStatusValue;
  status_detail: string | null;
  owner_name: string | null;
  source: string;
  source_url: string;
}

// Higher rank wins on conflict, so a later "sold" never gets overwritten by an older "available".
export const STATUS_RANK: Record<string, number> = {
  unknown: 0,
  retired: 1,
  active: 2,
  dlba_available: 3,
  pending: 4,
  sold: 5,
  for_sale_private: 6,
};

type Attrs = Record<string, unknown>;

export interface DatasetDef {
  key: string;
  label: string;
  service: string;
  layer?: number;
  where: string;
  outFields: string[];
  sourceUrl: string;
  useGeometry?: boolean;
  status: (a: Attrs) => BuildingStatusValue;
  detail?: (a: Attrs) => string | null;
  address?: (a: Attrs) => string | null;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
};

const BUILDING_STATUS_MAP: Record<string, BuildingStatusValue> = {
  Pending: "pending",
  Demolished: "retired",
  Retired: "retired",
  Current: "active",
};

export const DATASETS: Record<string, DatasetDef> = {
  dlba_owned: {
    key: "dlba_owned",
    label: "DLBA Owned Properties",
    service: "DLBA_Owned_Properties",
    where: "1=1",
    outFields: ["parcel_id", "name", "inventory_status_socrata", "longitude", "latitude"],
    sourceUrl: "https://hub.arcgis.com/datasets/848bc665295f4ca9b1e25068ffa88ab0_0",
    status: () => "dlba_available",
    detail: (a) => str(a.inventory_status_socrata),
    address: (a) => str(a.name),
  },
  dlba_for_sale: {
    key: "dlba_for_sale",
    label: "DLBA Properties For Sale",
    service: "DLBA_For_Sale",
    where: "1=1",
    outFields: ["parcel_id", "address", "program", "listing_date", "longitude", "latitude"],
    sourceUrl: `${BASE}/DLBA_For_Sale/FeatureServer/0`,
    status: () => "dlba_available",
    detail: (a) => ["Listed for sale", str(a.program), str(a.listing_date)].filter(Boolean).join(" · ") || null,
    address: (a) => str(a.address),
  },
  dlba_project_sales: {
    key: "dlba_project_sales",
    label: "DLBA Project Sales",
    service: "dlba_project_sales",
    where: "1=1",
    outFields: ["parcel_id", "address", "sale_closed_date", "sale_program", "longitude", "latitude"],
    sourceUrl: `${BASE}/dlba_project_sales/FeatureServer/0`,
    status: () => "sold",
    detail: (a) => ["Sold", str(a.sale_closed_date), str(a.sale_program)].filter(Boolean).join(" · ") || "Sold by DLBA",
    address: (a) => str(a.address),
  },
  dlba_own_it_now_sales: {
    key: "dlba_own_it_now_sales",
    label: "DLBA Own It Now Sales",
    service: "dlba_own_it_now_sales",
    where: "1=1",
    outFields: ["parcel_id", "address", "sale_closed_date", "sale_program", "longitude", "latitude"],
    sourceUrl: `${BASE}/dlba_own_it_now_sales/FeatureServer/0`,
    status: () => "sold",
    detail: (a) => ["Sold", str(a.sale_closed_date), str(a.sale_program)].filter(Boolean).join(" · ") || "Sold by DLBA",
    address: (a) => str(a.address),
  },
  // Currently returns zero rows (all buildings are "Current"), kept so the scope is easy to extend.
  buildings_noncurrent: {
    key: "buildings_noncurrent",
    label: "Base Units Buildings (non-current)",
    service: "BaseUnitFeatures",
    layer: 2,
    where: "status <> 'Current'",
    outFields: ["parcel_id", "status", "also_known_as"],
    sourceUrl: "https://baseunits.detroitmi.gov",
    useGeometry: true,
    status: (a) => BUILDING_STATUS_MAP[str(a.status) ?? ""] ?? "unknown",
    detail: (a) => (str(a.status) ? `Building status: ${str(a.status)}` : null),
  },
};

const orderFieldCache = new Map<string, string | null>();

async function getOrderField(def: DatasetDef): Promise<string | null> {
  const cacheKey = `${def.service}/${def.layer ?? 0}`;
  if (orderFieldCache.has(cacheKey)) return orderFieldCache.get(cacheKey) ?? null;
  try {
    const res = await fetch(`${BASE}/${def.service}/FeatureServer/${def.layer ?? 0}?f=json`, {
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await res.json()) as { fields?: { name: string }[] };
    const names = (j.fields ?? []).map((f) => f.name);
    const found = names.includes("ObjectId") ? "ObjectId" : names.includes("OBJECTID") ? "OBJECTID" : null;
    orderFieldCache.set(cacheKey, found);
    return found;
  } catch {
    return null;
  }
}

function ringCentroid(geometry: unknown): { lat: number; lng: number } | null {
  const rings = (geometry as { rings?: number[][][] } | undefined)?.rings;
  const ring = rings?.[0];
  if (!ring?.length) return null;
  let sx = 0;
  let sy = 0;
  for (const pt of ring) {
    sx += pt[0];
    sy += pt[1];
  }
  return { lng: sx / ring.length, lat: sy / ring.length };
}

export async function fetchArcGisPage(
  def: DatasetDef,
  offset: number,
  pageSize: number,
): Promise<{ rows: SyncRow[]; exceeded: boolean }> {
  const params = new URLSearchParams({
    where: def.where,
    outFields: def.outFields.join(","),
    returnGeometry: def.useGeometry ? "true" : "false",
    outSR: "4326",
    resultOffset: String(offset),
    resultRecordCount: String(pageSize),
    f: "json",
  });
  const orderField = await getOrderField(def);
  if (orderField) params.set("orderByFields", orderField);

  const res = await fetch(`${BASE}/${def.service}/FeatureServer/${def.layer ?? 0}/query?${params}`, {
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`Open data request failed (${res.status})`);
  const j = (await res.json()) as {
    features?: { attributes?: Attrs; geometry?: unknown }[];
    exceededTransferLimit?: boolean;
    error?: unknown;
  };
  if (j.error) throw new Error("Open data query error");

  const rows: SyncRow[] = [];
  for (const f of j.features ?? []) {
    const a = f.attributes ?? {};
    const parcelId = str(a.parcel_id);
    if (!parcelId) continue;
    let lat: number | null = null;
    let lng: number | null = null;
    if (def.useGeometry) {
      const c = ringCentroid(f.geometry);
      lat = c?.lat ?? null;
      lng = c?.lng ?? null;
    } else {
      lat = num(a.latitude);
      lng = num(a.longitude);
    }
    rows.push({
      parcel_id: parcelId,
      address: def.address ? def.address(a) : null,
      lat,
      lng,
      status: def.status(a),
      status_detail: def.detail ? def.detail(a) : null,
      owner_name: null,
      source: def.label,
      source_url: def.sourceUrl,
    });
  }
  return { rows, exceeded: j.exceededTransferLimit === true };
}

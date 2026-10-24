// Server-only: real Detroit open-data adapters for agent tools 1-6 (Stage 2).
// Field names verified live Oct 24 2026 — see docs/dataset-fields.md.
// Every result carries a `source` (and usually `sources`) with title, publisher, url, fetched_at.
// Missing values use "Not specified in source" rather than guesses.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ToolSource = { title: string; publisher: string; url: string; fetched_at: string };

const NOT_SPECIFIED = "Not specified in source";
const ARCGIS = "https://services2.arcgis.com/qvkbeam7Wirps6zC/arcgis/rest/services";
const PORTAL = "https://data.detroitmi.gov";
const PUBLISHER = "City of Detroit Open Data Portal";

// Short-lived in-memory cache so repeated questions in a session don't hammer the portal.
const CACHE_TTL = 5 * 60_000;
const cache = new Map<string, { at: number; rows: Attrs[] }>();
type Attrs = Record<string, unknown>;

async function arcQuery(
  service: string,
  layer: number,
  params: Record<string, string>,
  maxRecords = 50,
): Promise<Attrs[]> {
  const qs = new URLSearchParams({
    outFields: "*",
    returnGeometry: "false",
    f: "json",
    resultRecordCount: String(maxRecords),
    ...params,
  });
  const url = `${ARCGIS}/${service}/FeatureServer/${layer}/query?${qs}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.rows;
  const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`open data ${res.status}`);
  const j = (await res.json()) as { features?: { attributes?: Attrs }[]; error?: unknown };
  if (j.error) throw new Error("open data query error");
  const rows = (j.features ?? []).map((f) => f.attributes ?? {});
  cache.set(url, { at: Date.now(), rows });
  return rows;
}

export function serverDb() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("db not configured");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const now = () => new Date().toISOString();
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const val = (v: unknown): string => str(v) ?? (typeof v === "number" ? String(v) : NOT_SPECIFIED);
const esc = (s: string) => s.replace(/'/g, "''").slice(0, 120);
const src = (title: string, url: string): ToolSource => ({ title, publisher: PUBLISHER, url, fetched_at: now() });

const PARCELS_SRC = () => src("Parcels (Current), Office of the Assessor", `${ARCGIS}/parcel_file_current/FeatureServer/0`);
const BUILDINGS_SRC = () => src("Base Units Buildings", "https://baseunits.detroitmi.gov");
const DLBA_SRC = () => src("DLBA Owned Properties", "https://detroitlandbank.org");
const PERMITS_SRC = () => src("Building Permits (BSEED)", `${ARCGIS}/bseed_building_permits/FeatureServer/0`);
const BLIGHT_SRC = () => src("Blight Tickets (DAH)", `${ARCGIS}/blight_tickets/FeatureServer/0`);
const COMPLIANCE_SRC = () => src("Certificates of Compliance (BSEED)", `${ARCGIS}/bseed_active_commercial_compliance_certificates/FeatureServer/0`);
const CURATED_SRC = (): ToolSource => ({ title: "Detroit Permit Navigator curated reference", publisher: "Hand-curated by site admins", url: "https://detroitmi.gov", fetched_at: now() });

async function fetchParcelRows(input: { address?: string | null; parcel_id?: string | null }): Promise<Attrs[]> {
  if (input.parcel_id?.trim()) {
    const pid = esc(input.parcel_id.trim());
    const rows = await arcQuery("parcel_file_current", 0, { where: `parcel_id='${pid}'` }, 5);
    if (rows.length) return rows;
    // Parcel IDs often carry a trailing period in city data; try a prefix match.
    return arcQuery("parcel_file_current", 0, { where: `parcel_id like '${pid.replace(/\.$/, "")}%'` }, 5);
  }
  if (input.address?.trim()) {
    return arcQuery("parcel_file_current", 0, { where: `upper(address) like '%25${esc(input.address.trim().toUpperCase())}%25'` }, 5);
  }
  return [];
}

// ---------- Tool 1: lookup_parcel ----------
export async function lookupParcel(input: { address?: string | null; parcel_id?: string | null }) {
  const sources: ToolSource[] = [];
  try {
    const rows = await fetchParcelRows(input);
    sources.push(PARCELS_SRC());
    const row = rows[0];
    if (!row) {
      return {
        found: false,
        parcel_id: input.parcel_id?.trim() || NOT_SPECIFIED,
        address: input.address?.trim() || NOT_SPECIFIED,
        note: "No parcel matched in the Assessor's current parcel file.",
        source: sources[0],
        sources,
      };
    }
    const parcelId = val(row["parcel_id"]);
    // Building status (Base Units), DLBA ownership, and our own synced building_status table.
    let buildingStatus = NOT_SPECIFIED;
    try {
      const b = await arcQuery("BaseUnitFeatures", 2, { where: `parcel_id='${esc(parcelId)}'` }, 5);
      sources.push(BUILDINGS_SRC());
      buildingStatus = val(b[0]?.["status"]);
    } catch {
      buildingStatus = NOT_SPECIFIED;
    }
    let landBankOwned: boolean | null = null;
    try {
      const d = await arcQuery("DLBA_Owned_Properties", 0, { where: `parcel_id='${esc(parcelId)}'` }, 5);
      sources.push(DLBA_SRC());
      landBankOwned = d.length > 0;
    } catch {
      landBankOwned = null;
    }
    let mapStatus: { status: string; status_detail: string | null; last_synced_at: string | null } | null = null;
    try {
      const { data } = await serverDb()
        .from("building_status")
        .select("status, status_detail, last_synced_at")
        .eq("parcel_id", parcelId)
        .maybeSingle();
      if (data) {
        mapStatus = data;
        sources.push({ title: "Detroit building-status map (this site)", publisher: "Detroit Permit Navigator", url: "/map", fetched_at: now() });
      }
    } catch {
      /* optional enrichment */
    }
    return {
      found: true,
      parcel_id: parcelId,
      address: val(row["address"]),
      zoning_district: val(row["zoning_district"]),
      building_status: buildingStatus,
      land_bank_owned: landBankOwned,
      historic_overlap: str(row["local_historic_district"]) ?? "None listed in source",
      use_description: val(row["use_code_description"]),
      property_class: val(row["property_class_description"]),
      year_built: val(row["year_built"]),
      neighborhood: val(row["neighborhood"]),
      council_district: val(row["council_district"]),
      building_map_status: mapStatus,
      source: sources[0],
      sources,
    };
  } catch {
    return { error: "The city parcel lookup is unavailable right now. Try again in a few minutes.", source: PARCELS_SRC(), sources: [PARCELS_SRC()] };
  }
}

// ---------- Tool 2: check_use ----------
export async function checkUse(input: { address?: string | null; parcel_id?: string | null; intended_use?: string | null }) {
  const sources: ToolSource[] = [];
  try {
    const rows = await fetchParcelRows(input);
    sources.push(PARCELS_SRC());
    const row = rows[0];
    const zoning = row ? val(row["zoning_district"]) : NOT_SPECIFIED;
    const currentUse = row ? val(row["use_code_description"]) : NOT_SPECIFIED;
    sources.push({
      title: "Detroit Zoning Ordinance (Municode)",
      publisher: "City of Detroit / Municode",
      url: "https://library.municode.com/mi/detroit/codes/code_of_ordinances",
      fetched_at: now(),
    });
    return {
      result: "confirm_with_city",
      zoning_district: zoning,
      current_use: currentUse,
      intended_use: input.intended_use?.trim() || NOT_SPECIFIED,
      ordinance_section: NOT_SPECIFIED,
      link: "https://library.municode.com/mi/detroit/codes/code_of_ordinances",
      flags: [
        `The open data does not include a by-right/conditional use table for zoning district ${zoning}.`,
        "Confirm whether the intended use is by-right or conditional with the BSEED Zoning Division before applying.",
        str(row?.["local_historic_district"]) ? `Parcel sits in the ${str(row?.["local_historic_district"])} local historic district — exterior work needs Historic District Commission review.` : "",
      ].filter(Boolean),
      source: sources[0],
      sources,
    };
  } catch {
    return { error: "The city zoning lookup is unavailable right now.", source: PARCELS_SRC(), sources: [PARCELS_SRC()] };
  }
}

// ---------- Tool 3: list_blockers ----------
export async function listBlockers(input: { parcel_id?: string | null; address?: string | null }) {
  const sources: ToolSource[] = [];
  try {
    let pid = input.parcel_id?.trim() ?? null;
    if (!pid && input.address?.trim()) {
      const rows = await fetchParcelRows({ address: input.address });
      sources.push(PARCELS_SRC());
      pid = str(rows[0]?.["parcel_id"]);
    }
    if (!pid) {
      return { error: "A parcel ID or a matching address is needed to check blockers.", source: BLIGHT_SRC(), sources: [BLIGHT_SRC()] };
    }
    // Blight tickets have no open/closed flag; approximate "open" as balance due or no payment, not dismissed.
    let openTickets: number | null = null;
    try {
      const tickets = await arcQuery("blight_tickets", 0, { where: `parcel_id='${esc(pid)}'` }, 100);
      sources.push(BLIGHT_SRC());
      openTickets = tickets.filter((t) => {
        const disp = (str(t["disposition"]) ?? "").toUpperCase();
        const pay = (str(t["payment_status"]) ?? "").toUpperCase();
        const balance = Number(t["amt_balance_due"] ?? 0) || 0;
        if (disp.includes("DISMISS")) return false;
        return balance > 0 || pay.includes("NO PAYMENT") || pay === "";
      }).length;
    } catch {
      openTickets = null;
    }
    let certificate = NOT_SPECIFIED;
    try {
      const [comm, res] = await Promise.all([
        arcQuery("bseed_active_commercial_compliance_certificates", 0, { where: `parcel_id='${esc(pid)}'` }, 10),
        arcQuery("bseed_active_residential_compliance_certificates", 0, { where: `parcel_id='${esc(pid)}'` }, 10),
      ]);
      sources.push(COMPLIANCE_SRC());
      const active = [...comm.map(() => "commercial"), ...res.map(() => "residential")];
      certificate = active.length ? `Active (${active.join(", ")})` : "None active in source";
    } catch {
      certificate = NOT_SPECIFIED;
    }
    const flags: string[] = [];
    try {
      const { data } = await serverDb()
        .from("building_status")
        .select("status, status_detail")
        .eq("parcel_id", pid)
        .maybeSingle();
      if (data && (data.status === "pending" || data.status === "retired")) {
        flags.push(`Building-status map lists this parcel as ${data.status}${data.status_detail ? ` (${data.status_detail})` : ""}.`);
      }
    } catch {
      /* optional */
    }
    return {
      parcel_id: pid,
      open_blight_tickets: openTickets,
      open_blight_note: "Approximate: the blight-ticket dataset has no explicit open/closed flag; counted tickets with a balance due or no payment applied that were not dismissed.",
      certificate_of_compliance: certificate,
      flags,
      source: sources[0] ?? BLIGHT_SRC(),
      sources: sources.length ? sources : [BLIGHT_SRC()],
    };
  } catch {
    return { error: "The city blockers lookup is unavailable right now.", source: BLIGHT_SRC(), sources: [BLIGHT_SRC()] };
  }
}

// ---------- Tool 4: permit_history ----------
export async function permitHistory(input: { parcel_id?: string | null; address?: string | null }) {
  const sources = [PERMITS_SRC()];
  try {
    let where: string;
    if (input.parcel_id?.trim()) {
      where = `parcel_id='${esc(input.parcel_id.trim())}'`;
    } else if (input.address?.trim()) {
      where = `upper(address) like '%25${esc(input.address.trim().toUpperCase())}%25'`;
    } else {
      return { error: "A parcel ID or address is needed to look up permits.", source: sources[0], sources };
    }
    const rows = await arcQuery("bseed_building_permits", 0, { where, orderByFields: "issued_date DESC" }, 20);
    return {
      permits: rows.map((r) => ({
        id: val(r["record_id"]),
        type: val(r["permit_type"]),
        work_description: str(r["work_description"]) ?? NOT_SPECIFIED,
        submitted: str(r["submitted_date"]) ?? NOT_SPECIFIED,
        issued: str(r["issued_date"]) ?? NOT_SPECIFIED,
      })),
      count: rows.length,
      source: sources[0],
      sources,
    };
  } catch {
    return { error: "The city permit history lookup is unavailable right now.", source: sources[0], sources };
  }
}

// ---------- Tool 5: build_checklist ----------
export async function buildChecklist(input: { project_type?: string | null }) {
  const source = CURATED_SRC();
  try {
    let q = serverDb().from("rules").select("*").order("step_order");
    if (input.project_type?.trim()) q = q.eq("project_type", input.project_type.trim());
    const { data, error } = await q;
    if (error) throw error;
    return {
      steps: (data ?? []).map((r) => ({
        step_order: r.step_order,
        approval_name: r.approval_name,
        office: r.office ?? NOT_SPECIFIED,
        submit_where: r.submit_where ?? NOT_SPECIFIED,
        documents_needed: Array.isArray(r.documents_needed) ? r.documents_needed : [],
        notes: r.notes ?? null,
        is_sample: r.is_sample === true,
        source_url: r.source_url,
        last_verified_at: r.last_verified_at,
      })),
      note: data?.length ? "Rules are hand-curated by site admins; re-verify with the listed office." : "No curated rules for this project type yet.",
      source,
      sources: [source],
    };
  } catch {
    return { error: "The checklist rules are unavailable right now.", source, sources: [source] };
  }
}

// ---------- Tool 6: find_contacts ----------
export async function findContacts(input: { topic?: string | null }) {
  const source = CURATED_SRC();
  try {
    const db = serverDb();
    const { data: contacts, error } = await db.from("contacts").select("*").order("name");
    if (error) throw error;
    const topic = input.topic?.trim().toLowerCase() ?? "";
    const matches = (c: { name: string; helps_with: string | null; use_when: string | null; notes: string | null; type: string }) =>
      !topic ||
      [c.name, c.helps_with, c.use_when, c.notes, c.type].some((f) => f?.toLowerCase().includes(topic));
    const list = (contacts ?? []).filter(matches).map((c) => ({
      name: c.name,
      type: c.type,
      channel: [c.channel_type, c.channel_value].filter(Boolean).join(": ") || NOT_SPECIFIED,
      use_when: c.use_when ?? NOT_SPECIFIED,
      helps_with: c.helps_with ?? NOT_SPECIFIED,
      notes: c.notes ?? null,
      source_url: c.source_url,
      last_verified_at: c.last_verified_at,
    }));
    const out: Record<string, unknown> = { contacts: list, source, sources: [source] };
    if (/architect|engineer|design|drawings|plans/.test(topic)) {
      const { data: firms } = await db.from("architecture_firms").select("*").order("name");
      out["architecture_firms"] = (firms ?? []).map((f) => ({
        name: f.name,
        discipline: f.discipline ?? NOT_SPECIFIED,
        documented_detroit_work: f.documented_detroit_work ?? NOT_SPECIFIED,
        likely_fit: f.likely_fit ?? NOT_SPECIFIED,
        source_url: f.source_url,
      }));
    }
    return out;
  } catch {
    return { error: "The contact directory is unavailable right now.", source, sources: [source] };
  }
}

// ---------- Agent wiring ----------
export const TOOL_DECLARATIONS = [
  {
    name: "lookup_parcel",
    description: "Look up a Detroit parcel by street address or parcel ID. Returns zoning district, building status, land-bank ownership, historic district, and assessor facts.",
    parameters: { type: "OBJECT", properties: { address: { type: "STRING" }, parcel_id: { type: "STRING" } } },
  },
  {
    name: "check_use",
    description: "Check a parcel's zoning district and current use against an intended use. Explains whether the use must be confirmed with the city and lists flags such as historic districts.",
    parameters: { type: "OBJECT", properties: { address: { type: "STRING" }, parcel_id: { type: "STRING" }, intended_use: { type: "STRING" } } },
  },
  {
    name: "list_blockers",
    description: "List possible blockers for a parcel: open blight tickets (approximate), certificates of compliance, and building-status flags.",
    parameters: { type: "OBJECT", properties: { parcel_id: { type: "STRING" }, address: { type: "STRING" } } },
  },
  {
    name: "permit_history",
    description: "List recent BSEED building permits for a parcel or address.",
    parameters: { type: "OBJECT", properties: { parcel_id: { type: "STRING" }, address: { type: "STRING" } } },
  },
  {
    name: "build_checklist",
    description: "Get the curated, ordered approval checklist for a project type (new_build, alteration, change_of_use, industrial).",
    parameters: { type: "OBJECT", properties: { project_type: { type: "STRING" } } },
  },
  {
    name: "find_contacts",
    description: "Find city contacts and offices that help with a topic, and architecture/engineering firms when the topic is design-related.",
    parameters: { type: "OBJECT", properties: { topic: { type: "STRING" } } },
  },
];

export async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const s = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : null);
  switch (name) {
    case "lookup_parcel":
      return lookupParcel({ address: s("address"), parcel_id: s("parcel_id") });
    case "check_use":
      return checkUse({ address: s("address"), parcel_id: s("parcel_id"), intended_use: s("intended_use") });
    case "list_blockers":
      return listBlockers({ parcel_id: s("parcel_id"), address: s("address") });
    case "permit_history":
      return permitHistory({ parcel_id: s("parcel_id"), address: s("address") });
    case "build_checklist":
      return buildChecklist({ project_type: s("project_type") });
    case "find_contacts":
      return findContacts({ topic: s("topic") });
    default:
      return { error: `Unknown tool ${name}` };
  }
}

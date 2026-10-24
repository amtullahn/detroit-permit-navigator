import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DATASETS, STATUS_RANK, fetchArcGisPage, type SyncRow } from "./building-status.server";

export const SYNC_DATASETS = [
  { key: "dlba_owned", label: "DLBA owned properties" },
  { key: "dlba_for_sale", label: "DLBA listed for sale" },
  { key: "dlba_project_sales", label: "DLBA project sales" },
  { key: "dlba_own_it_now_sales", label: "DLBA Own It Now sales" },
  { key: "buildings_noncurrent", label: "Buildings pending / retired" },
] as const;

const PAGE_SIZE = 2000;
const MAX_ROWS_PER_CALL = 8000;
const CHUNK = 500;

export interface SyncResult {
  done: boolean;
  nextOffset: number;
  scanned: number;
  upserted: number;
}

export const syncBuildingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { dataset?: unknown; offset?: unknown };
    if (typeof o.dataset !== "string" || !DATASETS[o.dataset]) throw new Error("Unknown dataset");
    return { dataset: o.dataset, offset: Math.max(0, Math.floor(Number(o.offset ?? 0) || 0)) };
  })
  .handler(async ({ data, context }): Promise<SyncResult> => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles?.length) throw new Error("Admins only");

    const def = DATASETS[data.dataset]!;
    let offset = data.offset;
    let done = false;
    const collected = new Map<string, SyncRow>();

    while ([...collected.values()].length < MAX_ROWS_PER_CALL && !done) {
      const page = await fetchArcGisPage(def, offset, PAGE_SIZE);
      for (const r of page.rows) collected.set(r.parcel_id, r);
      offset += page.rows.length;
      if (!page.exceeded || page.rows.length === 0) done = true;
    }

    const rows = [...collected.values()];
    const ids = rows.map((r) => r.parcel_id);
    const existing = new Map<string, { status: string; manual_override: boolean }>();
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data: ex, error } = await supabase
        .from("building_status")
        .select("parcel_id, status, manual_override")
        .in("parcel_id", ids.slice(i, i + CHUNK));
      if (error) throw new Error("Couldn't read existing map data");
      for (const r of ex ?? []) existing.set(r.parcel_id, { status: r.status, manual_override: r.manual_override });
    }

    const now = new Date().toISOString();
    const toWrite = rows
      .filter((r) => {
        const ex = existing.get(r.parcel_id);
        if (ex?.manual_override) return false; // never overwrite manual entries
        if (ex && (STATUS_RANK[ex.status] ?? 0) > (STATUS_RANK[r.status] ?? 0)) return false;
        return true;
      })
      .map((r) => ({ ...r, manual_override: false, last_synced_at: now }));

    for (let i = 0; i < toWrite.length; i += CHUNK) {
      const { error } = await supabase
        .from("building_status")
        .upsert(toWrite.slice(i, i + CHUNK), { onConflict: "parcel_id" });
      if (error) throw new Error("Couldn't save map data");
    }

    return { done, nextOffset: offset, scanned: rows.length, upserted: toWrite.length };
  });

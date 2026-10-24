import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHeader } from "@tanstack/react-start/server";
import { DEMO_PROJECT_ID } from "./demo";
import { serverDb, checkUse, listBlockers, lookupParcel, permitHistory, type ToolSource } from "./detroit-tools.server";

type OverviewResult = {
  parcel: Awaited<ReturnType<typeof lookupParcel>>;
  use: Awaited<ReturnType<typeof checkUse>>;
  blockers: Awaited<ReturnType<typeof listBlockers>>;
  history: Awaited<ReturnType<typeof permitHistory>>;
  allSources: ToolSource[];
};

export const getProjectOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as Record<string, unknown>;
    const s = (k: string) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim() : null);
    return { address: s("address"), parcel_id: s("parcel_id"), intended_use: s("intended_use") };
  })
  .handler(({ data }) => buildOverview(data));

type OverviewInput = { address: string | null; parcel_id: string | null; intended_use: string | null };

async function buildOverview(data: OverviewInput): Promise<OverviewResult> {
    const parcel = await lookupParcel(data);
    const pid =
      data.parcel_id ??
      (typeof (parcel as { parcel_id?: unknown }).parcel_id === "string" &&
      (parcel as { parcel_id: string }).parcel_id !== "Not specified in source"
        ? (parcel as { parcel_id: string }).parcel_id
        : null);
    const [use, blockers, history] = await Promise.all([
      checkUse({ ...data, parcel_id: pid }),
      listBlockers({ parcel_id: pid, address: data.address }),
      permitHistory({ parcel_id: pid, address: data.address }),
    ]);
    const seen = new Set<string>();
    const allSources: ToolSource[] = [];
    for (const r of [parcel, use, blockers, history]) {
      const list = (r as { sources?: ToolSource[] }).sources ?? [];
      for (const s of list) {
        const key = `${s.title}|${s.url}`;
        if (!seen.has(key)) {
          seen.add(key);
          allSources.push(s);
        }
      }
    }
    return { parcel, use, blockers, history, allSources };
  }

// Public, read-only overview for the single demo project. Takes no client input:
// the address comes from the demo row itself, so this can't be used for arbitrary lookups.
const demoHits = new Map<string, number[]>();
export const getDemoOverview = createServerFn({ method: "POST" }).handler(async (): Promise<OverviewResult> => {
  const ip = getRequestHeader("cf-connecting-ip") ?? "unknown";
  const now = Date.now();
  const arr = (demoHits.get(ip) ?? []).filter((t) => now - t < 60_000);
  arr.push(now);
  demoHits.set(ip, arr);
  if (arr.length > 20) throw new Error("Too many requests. Please wait a minute.");
  const { data: p, error } = await serverDb()
    .from("projects")
    .select("address, parcel_id, intended_use")
    .eq("id", DEMO_PROJECT_ID)
    .maybeSingle();
  if (error || !p) throw new Error("Demo project unavailable");
  return buildOverview({ address: p.address, parcel_id: p.parcel_id, intended_use: p.intended_use });
});

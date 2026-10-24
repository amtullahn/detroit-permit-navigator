import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkUse, listBlockers, lookupParcel, permitHistory, type ToolSource } from "./detroit-tools.server";

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
  .handler(async ({ data }): Promise<OverviewResult> => {
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
  });

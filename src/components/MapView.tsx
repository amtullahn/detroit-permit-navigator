import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { toast } from "sonner";

type StatusKey = "dlba_available" | "sold" | "pending" | "active" | "retired" | "for_sale_private" | "unknown";

type Row = {
  parcel_id: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  status: StatusKey;
  status_detail: string | null;
  owner_name: string | null;
  source: string | null;
  source_url: string | null;
  last_synced_at: string | null;
  manual_override: boolean;
};

const STATUS_META: Record<StatusKey, { label: string; color: string }> = {
  dlba_available: { label: "City / Land Bank available", color: "#d97706" },
  sold: { label: "Sold by Land Bank", color: "#475569" },
  pending: { label: "Pending", color: "#7c3aed" },
  active: { label: "Active", color: "#15803d" },
  retired: { label: "Retired / demolished", color: "#78716c" },
  for_sale_private: { label: "For sale (private, manual)", color: "#be185d" },
  unknown: { label: "Unknown", color: "#9ca3af" },
};
const ALL_STATUSES = Object.keys(STATUS_META) as StatusKey[];
const LIMIT = 1500;
const COLUMNS = "parcel_id,address,lat,lng,status,status_detail,owner_name,source,source_url,last_synced_at,manual_override";

function BoundsWatcher({ onChange }: { onChange: (b: [number, number, number, number]) => void }) {
  const map = useMapEvents({
    moveend: () => push(),
    zoomend: () => push(),
  });
  function push() {
    const b = map.getBounds();
    onChange([b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]);
  }
  useEffect(() => push(), []);
  return null;
}

function FlyTo({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 16);
  }, [target]);
  return null;
}

export function MapView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [capped, setCapped] = useState(false);
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);
  const [enabled, setEnabled] = useState<Set<StatusKey>>(new Set(ALL_STATUSES));
  const [selected, setSelected] = useState<Row | null>(null);
  const [q, setQ] = useState("");
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!bounds) return;
    const t = setTimeout(async () => {
      let query = supabase
        .from("building_status")
        .select(COLUMNS)
        .not("lat", "is", null)
        .gte("lat", bounds[0])
        .lte("lat", bounds[2])
        .gte("lng", bounds[1])
        .lte("lng", bounds[3])
        .limit(LIMIT);
      if (enabled.size < ALL_STATUSES.length) query = query.in("status", [...enabled]);
      const { data, error } = await query;
      if (error) {
        toast.error("Couldn't load map data.");
        return;
      }
      setRows((data ?? []) as Row[]);
      setCapped((data?.length ?? 0) >= LIMIT);
    }, 350);
    return () => clearTimeout(t);
  }, [bounds, enabled]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim().replace(/[%_,]/g, " ");
    if (!term) return;
    const { data, error } = await supabase
      .from("building_status")
      .select(COLUMNS)
      .or(`address.ilike.%${term}%,parcel_id.ilike.%${term}%`)
      .limit(5);
    if (error) {
      toast.error("Search failed.");
      return;
    }
    const hits = (data ?? []) as Row[];
    if (!hits.length) {
      toast.info("No match in the map data yet.");
      return;
    }
    const first = hits.find((r) => r.lat != null && r.lng != null) ?? null;
    const top = hits[0];
    if (top) setSelected(top);
    if (first) setFlyTarget({ lat: first.lat as number, lng: first.lng as number });
  }

  function toggle(s: StatusKey) {
    const next = new Set(enabled);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setEnabled(next);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex gap-2" role="search" aria-label="Search parcels">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by address or parcel ID…"
          aria-label="Address or parcel ID"
          className="max-w-md"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <fieldset className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Filter by status">
        <legend className="sr-only">Status filters</legend>
        {ALL_STATUSES.map((s) => (
          <label key={s} className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled.has(s)} onChange={() => toggle(s)} className="accent-accent" />
            <span aria-hidden className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: STATUS_META[s].color }} />
            {STATUS_META[s].label}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <MapContainer center={[42.3314, -83.0458]} zoom={11} className="h-[65vh] w-full rounded-xl border">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <BoundsWatcher onChange={setBounds} />
            <FlyTo target={flyTarget} />
            {rows.map((r) =>
              r.lat != null && r.lng != null ? (
                <CircleMarker
                  key={r.parcel_id}
                  center={[r.lat, r.lng]}
                  radius={6}
                  pathOptions={{
                    color: STATUS_META[r.status]?.color ?? "#9ca3af",
                    fillColor: STATUS_META[r.status]?.color ?? "#9ca3af",
                    fillOpacity: 0.75,
                    weight: 1,
                  }}
                  eventHandlers={{ click: () => setSelected(r) }}
                />
              ) : null,
            )}
          </MapContainer>
          <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
            Showing {rows.length.toLocaleString()} parcel{rows.length === 1 ? "" : "s"} in view
            {capped ? " (zoom in to see more)" : ""}.
          </p>
        </div>

        <aside aria-label="Parcel details" className="rounded-xl border bg-card p-5 shadow-soft">
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{selected.address ?? "Address not in source"}</h2>
                <Button variant="ghost" size="icon" aria-label="Close details" onClick={() => setSelected(null)}>
                  <X />
                </Button>
              </div>
              <p>
                <span
                  className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: STATUS_META[selected.status]?.color ?? "#9ca3af" }}
                >
                  {STATUS_META[selected.status]?.label ?? selected.status}
                </span>
                {selected.manual_override && <span className="ml-2 text-xs text-muted-foreground">Added manually</span>}
              </p>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Parcel ID</dt>
                  <dd className="font-mono">{selected.parcel_id}</dd>
                </div>
                {selected.status_detail && (
                  <div>
                    <dt className="text-muted-foreground">Details</dt>
                    <dd>{selected.status_detail}</dd>
                  </div>
                )}
                {selected.owner_name && (
                  <div>
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd>{selected.owner_name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>
                    {selected.source_url ? (
                      <a href={selected.source_url} target="_blank" rel="noreferrer" className="text-primary underline">
                        {selected.source ?? "Open data"}
                      </a>
                    ) : (
                      (selected.source ?? "Not specified in source")
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Last synced</dt>
                  <dd>{selected.last_synced_at ? new Date(selected.last_synced_at).toLocaleDateString() : "Not specified"}</dd>
                </div>
              </dl>
              <a
                href={`https://baseunits.detroitmi.gov/map?id=${encodeURIComponent(selected.parcel_id)}&type=parcel&mode=parcel&layer=parcel`}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm font-medium text-primary underline"
              >
                Open in the city's Base Units map
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Click a pin to see the parcel's address, status, source, and a link to the city's Base Units map.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

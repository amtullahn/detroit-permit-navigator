import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { contactsQuery } from "@/lib/reference";
import { SYNC_DATASETS, syncBuildingStatus } from "@/lib/building-status.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Detroit Permit Navigator" },
      { name: "description", content: "Manage verified rules and contacts." },
      { property: "og:title", content: "Admin — Detroit Permit Navigator" },
      { property: "og:description", content: "Manage rules and contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <RequireAuth admin>
      <Admin />
    </RequireAuth>
  ),
});

function Admin() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <p className="eyebrow">Admin</p>
      <h1 className="mt-2 text-4xl font-bold">Rules library & contacts</h1>
      <Tabs defaultValue="rules" className="mt-8">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="map-sync">Map sync</TabsTrigger>
          <TabsTrigger value="manual-parcels">Manual parcels</TabsTrigger>
        </TabsList>
        <TabsContent value="rules"><RulesAdmin /></TabsContent>
        <TabsContent value="contacts"><ContactsAdmin /></TabsContent>
        <TabsContent value="map-sync"><MapSyncAdmin /></TabsContent>
        <TabsContent value="manual-parcels"><ManualParcelAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}

const EMPTY_RULE = { id: "", project_type: "change_of_use", use_category: "small_business", step_order: "1", approval_name: "", office: "", submit_where: "", documents_needed: "", source_url: "", last_verified_at: "", notes: "" };

function RulesAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-rules"], queryFn: async () => (await supabase.from("rules").select("*").order("project_type").order("step_order")).data ?? [] });
  const [f, setF] = useState(EMPTY_RULE);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row = {
      project_type: f.project_type, use_category: f.use_category, step_order: Number(f.step_order), approval_name: f.approval_name,
      office: f.office || null, submit_where: f.submit_where || null, source_url: f.source_url || null, notes: f.notes || null,
      documents_needed: f.documents_needed.split("\n").map((s) => s.trim()).filter(Boolean),
      last_verified_at: f.last_verified_at ? new Date(f.last_verified_at).toISOString() : null, is_sample: false,
    };
    const { error } = f.id ? await supabase.from("rules").update(row).eq("id", f.id) : await supabase.from("rules").insert(row);
    if (error) { toast.error("Couldn't save the rule."); return; }
    toast.success("Rule saved");
    setF(EMPTY_RULE);
    qc.invalidateQueries();
  }
  const field = (k: keyof typeof EMPTY_RULE, label: string, type = "text") => (
    <div className="space-y-1"><Label htmlFor={`r-${k}`}>{label}</Label><Input id={`r-${k}`} type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <div className="mt-6 grid gap-8 md:grid-cols-2">
      <form onSubmit={save} className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">{f.id ? "Edit rule" : "Add rule"}</h2>
        {field("project_type", "Project type (new_build, alteration, change_of_use, industrial)")}
        {field("use_category", "Use category")}
        {field("step_order", "Step order", "number")}
        {field("approval_name", "Approval name")}
        {field("office", "Office")}
        {field("submit_where", "Where to submit")}
        <div className="space-y-1"><Label htmlFor="r-docs">Documents (one per line)</Label><textarea id="r-docs" className="w-full rounded-md border bg-background p-2" rows={3} value={f.documents_needed} onChange={(e) => setF({ ...f, documents_needed: e.target.value })} /></div>
        {field("source_url", "Source URL", "url")}
        {field("last_verified_at", "Last verified", "date")}
        {field("notes", "Notes")}
        <div className="flex gap-2"><Button type="submit">Save</Button>{f.id && <Button type="button" variant="ghost" onClick={() => setF(EMPTY_RULE)}>Cancel</Button>}</div>
      </form>
      <ul className="space-y-2">
        {data?.map((r) => (
          <li key={r.id}>
            <button className="w-full rounded-lg border p-3 text-left hover:border-accent" onClick={() => setF({
              id: r.id, project_type: r.project_type, use_category: r.use_category, step_order: String(r.step_order), approval_name: r.approval_name,
              office: r.office ?? "", submit_where: r.submit_where ?? "", documents_needed: ((r.documents_needed as string[]) ?? []).join("\n"),
              source_url: r.source_url ?? "", last_verified_at: r.last_verified_at?.slice(0, 10) ?? "", notes: r.notes ?? "",
            })}>
              <span className="eyebrow">{r.project_type} · step {r.step_order}</span>
              <span className="block font-medium">{r.approval_name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery(contactsQuery);
  const [editing, setEditing] = useState<{ id: string; channel_value: string; source_url: string; last_verified_at: string; notes: string } | null>(null);
  async function save() {
    if (!editing) return;
    const { error } = await supabase.from("contacts").update({
      channel_value: editing.channel_value || null, source_url: editing.source_url || null, notes: editing.notes || null,
      last_verified_at: editing.last_verified_at ? new Date(editing.last_verified_at).toISOString() : null,
    }).eq("id", editing.id);
    if (error) { toast.error("Couldn't save the contact."); return; }
    toast.success("Contact saved");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["contacts"] });
  }
  return (
    <ul className="mt-6 space-y-2">
      {data?.map((c) => (
        <li key={c.id} className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="font-medium">{c.name}</span>
            <Button size="sm" variant="outline" onClick={() => setEditing({ id: c.id, channel_value: c.channel_value ?? "", source_url: c.source_url ?? "", last_verified_at: c.last_verified_at?.slice(0, 10) ?? "", notes: c.notes ?? "" })}>Edit</Button>
          </div>
          {editing?.id === c.id && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(["channel_value", "source_url", "last_verified_at", "notes"] as const).map((k) => (
                <div key={k} className="space-y-1"><Label htmlFor={`c-${k}`}>{k.replace(/_/g, " ")}</Label>
                  <Input id={`c-${k}`} type={k === "last_verified_at" ? "date" : "text"} value={editing[k]} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} /></div>
              ))}
              <div className="flex gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function MapSyncAdmin() {
  const [log, setLog] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);

  async function run(key: string) {
    setRunning(true);
    let offset = 0;
    let upserted = 0;
    let scanned = 0;
    try {
      for (;;) {
        const r = await syncBuildingStatus({ data: { dataset: key, offset } });
        upserted += r.upserted;
        scanned += r.scanned;
        offset = r.nextOffset;
        setLog((l) => ({ ...l, [key]: `Working… scanned ${scanned.toLocaleString()}, saved ${upserted.toLocaleString()}` }));
        if (r.done) break;
      }
      setLog((l) => ({ ...l, [key]: `Done. Scanned ${scanned.toLocaleString()}, saved ${upserted.toLocaleString()}.` }));
    } catch {
      setLog((l) => ({ ...l, [key]: "Failed partway. Run it again to continue." }));
    } finally {
      setRunning(false);
    }
  }

  async function runAll() {
    for (const d of SYNC_DATASETS) await run(d.key);
  }

  return (
    <div className="mt-6 space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Sync from city open data</h2>
          <p className="text-sm text-muted-foreground">
            Pulls land bank and building status datasets into the map. Manually entered parcels are never overwritten.
          </p>
        </div>
        <Button onClick={runAll} disabled={running}>{running ? "Syncing…" : "Refresh all"}</Button>
      </div>
      <ul className="space-y-2">
        {SYNC_DATASETS.map((d) => (
          <li key={d.key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <span className="font-medium">{d.label}</span>
              {log[d.key] && <span className="block text-sm text-muted-foreground" aria-live="polite">{log[d.key]}</span>}
            </div>
            <Button size="sm" variant="outline" onClick={() => run(d.key)} disabled={running}>Refresh</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const EMPTY_PARCEL = { parcel_id: "", address: "", lat: "", lng: "", status: "for_sale_private", status_detail: "", owner_name: "", source_url: "" };

function ManualParcelAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["manual-parcels"],
    queryFn: async () =>
      (await supabase.from("building_status").select("*").eq("manual_override", true).order("last_synced_at", { ascending: false })).data ?? [],
  });
  const [f, setF] = useState(EMPTY_PARCEL);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.parcel_id.trim()) { toast.error("Parcel ID is required."); return; }
    const row = {
      parcel_id: f.parcel_id.trim(),
      address: f.address.trim() || null,
      lat: f.lat ? Number(f.lat) : null,
      lng: f.lng ? Number(f.lng) : null,
      status: f.status,
      status_detail: f.status_detail.trim() || null,
      owner_name: f.owner_name.trim() || null,
      source: "Manual entry",
      source_url: f.source_url.trim() || null,
      manual_override: true,
      last_synced_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("building_status").upsert(row, { onConflict: "parcel_id" });
    if (error) { toast.error("Couldn't save the parcel."); return; }
    toast.success("Parcel saved");
    setF(EMPTY_PARCEL);
    qc.invalidateQueries({ queryKey: ["manual-parcels"] });
  }

  const field = (k: keyof typeof EMPTY_PARCEL, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`mp-${k}`}>{label}</Label>
      <Input id={`mp-${k}`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="mt-6 grid gap-8 md:grid-cols-2">
      <form onSubmit={save} className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Add or edit a parcel</h2>
        <p className="text-sm text-muted-foreground">Manual entries set the override flag, so open-data syncs leave them alone.</p>
        {field("parcel_id", "Parcel ID")}
        {field("address", "Address")}
        <div className="grid grid-cols-2 gap-3">{field("lat", "Latitude")}{field("lng", "Longitude")}</div>
        <div className="space-y-1">
          <Label htmlFor="mp-status">Status</Label>
          <select id="mp-status" className="w-full rounded-md border bg-background p-2" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="for_sale_private">For sale (private)</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="retired">Retired / demolished</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        {field("status_detail", "Details (e.g. asking price, agent)")}
        {field("owner_name", "Owner name (optional)")}
        {field("source_url", "Listing URL (optional)")}
        <Button type="submit">Save parcel</Button>
      </form>
      <ul className="space-y-2">
        {data?.map((r) => (
          <li key={r.parcel_id} className="rounded-lg border p-3">
            <button
              className="w-full text-left"
              onClick={() =>
                setF({
                  parcel_id: r.parcel_id, address: r.address ?? "", lat: r.lat != null ? String(r.lat) : "",
                  lng: r.lng != null ? String(r.lng) : "", status: r.status, status_detail: r.status_detail ?? "",
                  owner_name: r.owner_name ?? "", source_url: r.source_url ?? "",
                })
              }
            >
              <span className="eyebrow">{r.status}</span>
              <span className="block font-medium">{r.address ?? r.parcel_id}</span>
            </button>
          </li>
        ))}
        {data?.length === 0 && <li className="text-sm text-muted-foreground">No manual parcels yet.</li>}
      </ul>
    </div>
  );
}

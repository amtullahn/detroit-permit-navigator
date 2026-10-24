import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Building2, CheckCircle2, ExternalLink, Landmark, Printer, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequireAuth } from "@/components/RequireAuth";
import { GlossaryText } from "@/components/GlossaryText";
import { ProjectChat, type ChatSource } from "@/components/ProjectChat";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { configQuery, contactsQuery, firmsQuery, GUIDANCE_NOTICE, isStale, NOT_SPECIFIED, PROJECT_TYPES, verifiedLabel } from "@/lib/reference";
import { getProjectOverview } from "@/lib/detroit-tools.functions";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project checklist — Detroit Permit Navigator" },
      { name: "description", content: "Your ordered approvals, contacts, and sources for this Detroit project." },
      { property: "og:title", content: "Project checklist — Detroit Permit Navigator" },
      { property: "og:description", content: "Ordered approvals with sources." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ProjectPage />
    </RequireAuth>
  ),
});

type PanelSource = { key: string; title: string; publisher: string; url: string | null; date: string | null; cite?: number };

function ProjectPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const project = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const p = project.data;
  const rules = useQuery({
    enabled: !!p,
    queryKey: ["rules", p?.project_type],
    queryFn: async () => {
      const { data, error } = await supabase.from("rules").select("*").eq("project_type", p!.project_type).order("step_order");
      if (error) throw error;
      return data;
    },
  });
  const checklist = useQuery({
    queryKey: ["checklist", id],
    queryFn: async () => {
      const { data } = await supabase.from("project_checklists").select("step_state").eq("project_id", id).maybeSingle();
      return (data?.step_state ?? {}) as Record<string, boolean>;
    },
  });
  const { data: config } = useQuery(configQuery);
  const { data: contacts } = useQuery(contactsQuery);
  const staleDays = Number(config?.["stale_days"] ?? 90);
  const [chatSources, setChatSources] = useState<ChatSource[]>([]);
  const [cite, setCite] = useState<number | null>(null);
  const overview = useQuery({
    enabled: !!p,
    queryKey: ["overview", id],
    staleTime: 5 * 60_000,
    queryFn: () => getProjectOverview({ data: { address: p!.address, parcel_id: p!.parcel_id, intended_use: p!.intended_use } }),
  });

  if (project.isLoading) return <p className="py-20 text-center text-muted-foreground">Loading…</p>;
  if (!p) return <p className="py-20 text-center">Project not found. <Link to="/projects" className="text-primary underline">Back to projects</Link></p>;

  const ov = overview.data;
  const parcel = ov?.parcel && !("error" in ov.parcel) ? ov.parcel : null;
  const use = ov?.use && !("error" in ov.use) ? ov.use : null;
  const blockers = ov?.blockers && !("error" in ov.blockers) ? ov.blockers : null;
  const history = ov?.history && !("error" in ov.history) ? ov.history : null;
  const state = checklist.data ?? {};
  const steps = rules.data ?? [];
  const done = steps.filter((s) => state[s.id]).length;
  const drc = contacts?.find((c) => c.name.includes("Development Resource Center"));
  const liaison = contacts?.find((c) => c.name.includes("District Business Liaisons"));

  async function toggle(stepId: string, v: boolean) {
    const next = { ...state, [stepId]: v };
    qc.setQueryData(["checklist", id], next);
    const { error } = await supabase.from("project_checklists").upsert({ project_id: id, step_state: next, updated_at: new Date().toISOString() });
    if (error) toast.error("Couldn't save your progress.");
  }

  const sources: PanelSource[] = [
    ...chatSources.map((s) => ({ key: `c${s.id}`, title: s.title, publisher: s.publisher, url: s.url, date: s.retrieved_at, cite: s.id })),
    ...[parcel.source, blockers.source, history.source].map((s) => ({ key: s.title, title: s.title, publisher: s.publisher, url: s.url, date: s.fetched_at })),
    ...steps.map((s) => ({ key: s.id, title: s.approval_name, publisher: s.office ?? NOT_SPECIFIED, url: s.source_url, date: s.last_verified_at })),
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="no-print">
        <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground">← My projects</Link>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{PROJECT_TYPES.find((t) => t.value === p.project_type)?.label} · {p.intended_use}{p.size ? ` · ${p.size}` : ""}</p>
          <h1 className="mt-2 text-4xl font-bold">{p.address || p.parcel_id}</h1>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="no-print"><Printer /> Print or save as PDF</Button>
      </div>

      <div role="note" className="mt-6 flex gap-3 rounded-lg border border-accent/40 bg-amber-soft px-4 py-3 text-[0.95rem]">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden /> {GUIDANCE_NOTICE}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="space-y-8">
          <section aria-labelledby="parcel-h" className="rounded-xl border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 id="parcel-h" className="text-xl font-semibold">Parcel lookup</h2>
              <span className="eyebrow rounded bg-muted px-2 py-0.5">Mock data</span>
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {[
                ["Parcel ID", parcel.parcel_id],
                ["Zoning district", parcel.zoning_district],
                ["Building status", parcel.building_status],
                ["Land bank owned", parcel.land_bank_owned ? "Yes" : "No"],
                ["Historic district", parcel.historic_overlap],
                ["Past permits", history.permits.map((h) => `${h.id} · ${h.type}`).join(", ")],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Use check</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-warning"><Landmark className="h-5 w-5" aria-hidden /> {use.result}</p>
                <p className="text-sm">Ordinance section: {use.ordinance_section}</p>
                {use.flags.map((f) => <p key={f} className="text-sm text-muted-foreground"><GlossaryText text={f} /></p>)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Blockers</p>
                <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-success"><CheckCircle2 className="h-5 w-5" aria-hidden /> {blockers.open_blight_tickets} open blight tickets</p>
                <p className="text-sm"><GlossaryText text={`Certificate of Compliance: ${blockers.certificate_of_compliance}`} /></p>
              </div>
            </div>
          </section>

          <section aria-labelledby="check-h">
            <div className="flex items-end justify-between gap-4">
              <h2 id="check-h" className="text-2xl font-bold">Your approvals, in order</h2>
              <span className="text-sm text-muted-foreground">{done} of {steps.length} done</span>
            </div>
            <Progress value={steps.length ? (done / steps.length) * 100 : 0} className="mt-3 h-2" aria-label="Checklist progress" />
            {steps.length === 0 && !rules.isLoading && (
              <p className="mt-6 rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                No verified rules for this project type yet. Contact the Development Resource Center at (313) 224-2372.
              </p>
            )}
            <ol className="mt-6 space-y-4" aria-label="Approval checklist">
              {steps.map((s, i) => {
                const docs = Array.isArray(s.documents_needed) ? (s.documents_needed as string[]) : [];
                const stale = isStale(s.last_verified_at, staleDays);
                return (
                  <li key={s.id} className="rounded-xl border bg-card p-6 shadow-soft">
                    <div className="flex items-start gap-4">
                      <Checkbox id={`s-${s.id}`} checked={!!state[s.id]} onCheckedChange={(v) => toggle(s.id, v === true)} className="mt-1.5 h-5 w-5" aria-label={`Mark step ${i + 1} done`} />
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-muted-foreground">Step {i + 1}</span>
                          {s.is_sample && <span className="eyebrow rounded bg-destructive/10 px-2 py-0.5 !text-destructive">Sample content</span>}
                          {stale && <span className="inline-flex items-center gap-1 rounded bg-amber-soft px-2 py-0.5 text-xs font-medium text-warning"><AlertTriangle className="h-3 w-3" aria-hidden /> This may be out of date, re-check with the city</span>}
                        </div>
                        <Label htmlFor={`s-${s.id}`} className="mt-1 block text-lg font-semibold">{s.approval_name}</Label>
                        <dl className="mt-3 grid gap-3 text-[0.95rem] sm:grid-cols-2">
                          <div><dt className="text-sm text-muted-foreground">Office</dt><dd><GlossaryText text={s.office ?? NOT_SPECIFIED} /></dd></div>
                          <div><dt className="text-sm text-muted-foreground">Where & how to submit</dt><dd>{s.submit_where ?? NOT_SPECIFIED}</dd></div>
                          <div className="sm:col-span-2">
                            <dt className="text-sm text-muted-foreground">Documents needed</dt>
                            <dd>{docs.length ? <ul className="list-disc pl-5">{docs.map((d) => <li key={d}>{d}</li>)}</ul> : NOT_SPECIFIED}</dd>
                          </div>
                          <div><dt className="text-sm text-muted-foreground">Suggested first contact</dt><dd>{(i === 0 ? drc : liaison)?.name ?? NOT_SPECIFIED}</dd></div>
                          <div>
                            <dt className="text-sm text-muted-foreground">Source</dt>
                            <dd>{s.source_url ? <a href={s.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Open source <ExternalLink className="h-3.5 w-3.5" aria-hidden /></a> : NOT_SPECIFIED}
                              <span className="block text-sm text-muted-foreground">{verifiedLabel(s.last_verified_at)}</span></dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <div className="no-print"><ProjectChat projectId={id} onSources={setChatSources} onCite={setCite} /></div>
          <FirmPicker />
          <SubmissionLog projectId={id} />
        </div>

        <aside aria-label="Sources" className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5 shadow-soft">
            <h2 className="font-semibold">Sources</h2>
            <ul className="mt-4 space-y-3">
              {sources.map((s) => (
                <li key={s.key} className={`rounded-lg border p-3 text-sm transition ${s.cite && s.cite === cite ? "border-accent bg-amber-soft" : ""}`}>
                  {s.cite && <span className="mr-1 font-mono text-xs text-primary">[{s.cite}]</span>}
                  {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">{s.title}</a> : <span className="font-medium">{s.title}</span>}
                  <p className="text-muted-foreground">{s.publisher}</p>
                  <p className="text-xs text-muted-foreground">{s.date ? `Last verified on ${new Date(s.date).toLocaleDateString()}` : "Pending re-verification"}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function FirmPicker() {
  const { data } = useQuery(firmsQuery);
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <section aria-labelledby="firms-h" className="rounded-xl border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" aria-hidden /><h2 id="firms-h" className="text-xl font-semibold">Architecture & engineering firms</h2></div>
      <p className="mt-1 text-sm text-muted-foreground">Starting points from published project coverage, not endorsements or a complete list. Choose up to three.</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {data?.map((f) => {
          const on = picked.includes(f.id);
          return (
            <li key={f.id}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${on ? "border-accent bg-amber-soft" : ""}`}>
                <Checkbox checked={on} disabled={!on && picked.length >= 3} onCheckedChange={(v) => setPicked(v ? [...picked, f.id] : picked.filter((x) => x !== f.id))} className="mt-1" />
                <span><span className="font-medium">{f.name}</span><span className="block text-sm text-muted-foreground">{f.discipline} · {f.documented_detroit_work}</span></span>
              </label>
            </li>
          );
        })}
      </ul>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="rule-amber pl-3">Michigan licenses individuals, not firms. Look up the person who will seal your drawings at <a className="text-primary underline" href="https://www.michigan.gov/licenselookup" target="_blank" rel="noreferrer">michigan.gov/licenselookup</a></li>
        <li className="rule-amber pl-3">The city's site plan checklist requires plans sealed by an architect or engineer licensed in Michigan.</li>
      </ul>
    </section>
  );
}

function SubmissionLog({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const log = useQuery({
    queryKey: ["log", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("submission_log").select("*").eq("project_id", projectId).order("occurred_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [form, setForm] = useState({ action: "", occurred_at: "", reminder_date: "", notes: "" });
  useEffect(() => setForm((f) => ({ ...f, occurred_at: new Date().toISOString().slice(0, 10) })), []);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("submission_log").insert({
      project_id: projectId,
      action: form.action,
      occurred_at: new Date(form.occurred_at).toISOString(),
      reminder_date: form.reminder_date || null,
      notes: form.notes || null,
    });
    if (error) { toast.error("Couldn't save that entry."); return; }
    setForm({ ...form, action: "", notes: "", reminder_date: "" });
    qc.invalidateQueries({ queryKey: ["log", projectId] });
  }
  return (
    <section aria-labelledby="log-h" className="rounded-xl border bg-card p-6 shadow-soft">
      <h2 id="log-h" className="text-xl font-semibold">Submission log</h2>
      <p className="mt-1 text-sm text-muted-foreground">What you submitted, when, and what each office asked for.</p>
      <form onSubmit={add} className="no-print mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="la">What happened</Label><Input id="la" required value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} placeholder="e.g. Submitted plans to BSEED" /></div>
        <div className="space-y-1"><Label htmlFor="ld">Date</Label><Input id="ld" type="date" required value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} /></div>
        <div className="space-y-1"><Label htmlFor="lr">Follow-up reminder (optional)</Label><Input id="lr" type="date" value={form.reminder_date} onChange={(e) => setForm({ ...form, reminder_date: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="ln">What they asked for (optional)</Label><Input id="ln" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        <div><Button type="submit">Add entry</Button></div>
      </form>
      <ul className="mt-6 divide-y">
        {log.data?.map((l) => (
          <li key={l.id} className="py-3">
            <p className="font-medium">{l.action}</p>
            <p className="text-sm text-muted-foreground">{new Date(l.occurred_at).toLocaleDateString()}{l.reminder_date ? ` · Follow up ${l.reminder_date}` : ""}{l.notes ? ` · ${l.notes}` : ""}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

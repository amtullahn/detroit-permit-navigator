import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RequireAuth } from "@/components/RequireAuth";
import { PROJECT_TYPES } from "@/lib/reference";

export const Route = createFileRoute("/projects/new")({
  head: () => ({
    meta: [
      { title: "New project — Detroit Permit Navigator" },
      { name: "description", content: "Enter a Detroit address or parcel ID and your project type." },
      { property: "og:title", content: "New project — Detroit Permit Navigator" },
      { property: "og:description", content: "Start a new permit path." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <NewProject />
    </RequireAuth>
  ),
});

function NewProject() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ address: "", parcel_id: "", project_type: "change_of_use", intended_use: "", size: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.address.trim() && !form.parcel_id.trim()) return setErr("Enter an address or a parcel ID.");
    setSaving(true);
    setErr(null);
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...form, address: form.address || null, parcel_id: form.parcel_id || null })
      .select("id")
      .single();
    setSaving(false);
    if (error) return setErr("We couldn't save your project. Please try again.");
    navigate({ to: "/projects/$id", params: { id: data.id } });
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <p className="eyebrow">New project</p>
      <h1 className="mt-2 text-4xl font-bold">Where, and what?</h1>
      <p className="mt-2 text-muted-foreground">Look up by address or parcel ID only.</p>
      <form onSubmit={submit} className="mt-10 space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address">Detroit address</Label>
            <Input id="address" className="h-11" placeholder="e.g. 1234 Woodward Ave" value={form.address} onChange={set("address")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="parcel">or Parcel ID</Label>
            <Input id="parcel" className="h-11" value={form.parcel_id} onChange={set("parcel_id")} />
          </div>
        </div>
        <fieldset className="space-y-3">
          <legend className="font-medium">Project type</legend>
          <RadioGroup value={form.project_type} onValueChange={(v) => setForm({ ...form, project_type: v })} className="grid gap-3 sm:grid-cols-2">
            {PROJECT_TYPES.map((t) => (
              <Label key={t.value} htmlFor={t.value} className="flex cursor-pointer items-center gap-3 rounded-lg border p-4 font-normal has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-amber-soft">
                <RadioGroupItem id={t.value} value={t.value} /> {t.label}
              </Label>
            ))}
          </RadioGroup>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="use">Intended use</Label>
            <Input id="use" required className="h-11" placeholder="e.g. coffee shop" value={form.intended_use} onChange={set("intended_use")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="size">Rough size</Label>
            <Input id="size" className="h-11" placeholder="e.g. 1,800 sq ft" value={form.size} onChange={set("size")} />
          </div>
        </div>
        {err && <p role="alert" className="text-destructive">{err}</p>}
        <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving…" : "Build my checklist"}</Button>
      </form>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/hooks/useAuth";
import { PROJECT_TYPES } from "@/lib/reference";

export const Route = createFileRoute("/projects/")({
  head: () => ({
    meta: [
      { title: "My projects — Detroit Permit Navigator" },
      { name: "description", content: "Your saved Detroit permit projects and checklists." },
      { property: "og:title", content: "My projects — Detroit Permit Navigator" },
      { property: "og:description", content: "Your saved permit projects." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Projects />
    </RequireAuth>
  ),
});

function Projects() {
  const { session } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["projects", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">My projects</p>
          <h1 className="mt-2 text-4xl font-bold">Your permit paths</h1>
        </div>
        <Button asChild>
          <Link to="/projects/new"><Plus /> New project</Link>
        </Button>
      </div>
      {isLoading && <p className="mt-10 text-muted-foreground">Loading…</p>}
      {data?.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed p-12 text-center">
          <p className="text-lg font-medium">No projects yet</p>
          <p className="mt-1 text-muted-foreground">Start with an address and what you plan to do there.</p>
        </div>
      )}
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {data?.map((p) => (
          <li key={p.id}>
            <Link to="/projects/$id" params={{ id: p.id }} className="block rounded-xl border bg-card p-6 shadow-soft transition hover:border-accent">
              <span className="eyebrow">{PROJECT_TYPES.find((t) => t.value === p.project_type)?.label}</span>
              <h2 className="mt-2 flex items-center gap-2 text-lg font-semibold">
                <MapPin className="h-4 w-4 text-accent" aria-hidden /> {p.address || p.parcel_id}
              </h2>
              <p className="mt-1 text-muted-foreground">{p.intended_use}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

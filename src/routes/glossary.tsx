import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { glossaryQuery } from "@/lib/reference";

export const Route = createFileRoute("/glossary")({
  head: () => ({
    meta: [
      { title: "Glossary — Detroit Permit Navigator" },
      { name: "description", content: "Plain-language definitions of Detroit permitting terms like BSEED, zoning, and Certificate of Occupancy." },
      { property: "og:title", content: "Detroit permitting glossary" },
      { property: "og:description", content: "Plain-language definitions of permitting terms and acronyms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Glossary,
});

function Glossary() {
  const { data } = useQuery(glossaryQuery);
  const [q, setQ] = useState("");
  const list = (data ?? []).filter((g) => (g.term + g.definition).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <p className="eyebrow">Glossary</p>
      <h1 className="mt-2 text-4xl font-bold">Words you'll hear at the city</h1>
      <div className="relative mt-8">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input aria-label="Search glossary" placeholder="Search terms" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 pl-9" />
      </div>
      <dl className="mt-8 divide-y">
        {list.map((g) => (
          <div key={g.id} className="py-5">
            <dt className="flex items-center gap-3 font-display text-lg font-semibold">
              {g.term}
              {g.status === "draft" && <span className="eyebrow rounded bg-amber-soft px-2 py-0.5">Draft · pending review</span>}
            </dt>
            <dd className="mt-1 text-muted-foreground">{g.definition}</dd>
            {g.learn_more_url && (
              <a className="mt-1 inline-block text-sm text-primary hover:underline" href={g.learn_more_url} target="_blank" rel="noreferrer">
                Learn more
              </a>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

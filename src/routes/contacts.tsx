import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Mail, Phone, Globe } from "lucide-react";
import { contactsQuery, verifiedLabel, NOT_SPECIFIED } from "@/lib/reference";
import { GlossaryText } from "@/components/GlossaryText";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Contacts directory — Detroit Permit Navigator" },
      { name: "description", content: "Detroit and Michigan offices that handle permits, zoning, water, and environmental approvals." },
      { property: "og:title", content: "Detroit permit contacts directory" },
      { property: "og:description", content: "Offices, programs, and published role contacts for Detroit permitting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contacts,
});

const ICON = { email: Mail, phone: Phone, web_form: Globe } as const;

function Contacts() {
  const { data, isLoading } = useQuery(contactsQuery);
  return (
    <div className="mx-auto max-w-6xl px-6 py-14">
      <p className="eyebrow">Directory</p>
      <h1 className="mt-2 text-4xl font-bold">Who handles what</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Offices and programs only, never private individuals.</p>
      {isLoading && <p className="mt-10 text-muted-foreground">Loading…</p>}
      <ul className="mt-10 grid gap-4 md:grid-cols-2">
        {data?.map((c) => {
          const Icon = ICON[(c.channel_type as keyof typeof ICON) ?? "web_form"] ?? Globe;
          return (
            <li key={c.id} className="rounded-xl border bg-card p-6 shadow-soft">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-lg font-semibold">
                  <GlossaryText text={c.name} />
                </h2>
                <span className="eyebrow shrink-0">{c.type}</span>
              </div>
              <p className="mt-2"><GlossaryText text={c.helps_with ?? NOT_SPECIFIED} /></p>
              <p className="mt-2 text-sm text-muted-foreground"><strong className="text-foreground">Use when:</strong> {c.use_when ?? NOT_SPECIFIED}</p>
              <p className="mt-3 flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4 text-primary" aria-hidden /> {c.channel_value ?? NOT_SPECIFIED}
              </p>
              {c.notes && <p className="mt-1 text-sm text-muted-foreground">{c.notes}</p>}
              <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-warning">{verifiedLabel(c.last_verified_at)}</span>
                {c.source_url ? (
                  <a href={c.source_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                    Source <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : (
                  <span className="text-muted-foreground">{NOT_SPECIFIED}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

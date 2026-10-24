import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ListOrdered, MapPin, Users, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import skyline from "@/assets/detroit-skyline.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Detroit Permit Navigator — Know who to call and in what order" },
      { name: "description", content: "Enter a Detroit address and project type to get an ordered, sourced list of approvals, documents, and contacts." },
      { property: "og:title", content: "Detroit Permit Navigator" },
      { property: "og:description", content: "Ordered, sourced permit guidance for Detroit small businesses, startups, and first-time developers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STEPS = [
  { icon: MapPin, title: "Enter your address", body: "Address or parcel ID, plus what you plan to build or open." },
  { icon: ListOrdered, title: "Get the order", body: "An ordered list of approvals, each with its source and date." },
  { icon: Users, title: "Know who to call", body: "The right office for each step, and who to reach first." },
  { icon: FileText, title: "Walk in prepared", body: "A packet for your pre-plan meeting with the city." },
];

function Index() {
  return (
    <>
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <img src={skyline} alt="" width={1600} height={800} className="absolute inset-0 h-full w-full object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/80 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-6 py-28 md:py-36">
          <p className="eyebrow !text-accent">Motor City · Permits, in order</p>
          <h1 className="mt-4 max-w-2xl text-5xl font-extrabold md:text-6xl">
            The forms aren't the hard part. The order is.
          </h1>
          <p className="mt-6 max-w-xl text-lg opacity-90">
            Tell us your address and project. We'll lay out which approvals you need, who handles each one, and what to bring.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/projects/new">
                Start a project <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/contacts">Browse contacts</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <p className="eyebrow">How it works</p>
        <div className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rule-amber pl-5">
              <span className="font-mono text-sm text-muted-foreground">0{i + 1}</span>
              <s.icon className="mt-3 h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold">{s.title}</h2>
              <p className="mt-1 text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

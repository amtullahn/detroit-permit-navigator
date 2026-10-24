import { createFileRoute } from "@tanstack/react-router";
import { ProjectView } from "@/components/ProjectView";
import { DEMO_PROJECT_ID } from "@/lib/demo";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo project: 1001 Woodward Ave — Detroit Permit Navigator" },
      { name: "description", content: "See a sample Detroit permit checklist with live parcel data, no sign-in needed." },
      { property: "og:title", content: "Demo project — Detroit Permit Navigator" },
      { property: "og:description", content: "A read-only sample project showing ordered approvals and city data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ProjectView id={DEMO_PROJECT_ID} demo />,
});

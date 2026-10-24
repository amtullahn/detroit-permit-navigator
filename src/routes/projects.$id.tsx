import { createFileRoute } from "@tanstack/react-router";
import { RequireAuth } from "@/components/RequireAuth";
import { ProjectView } from "@/components/ProjectView";

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
  component: ProjectRoute,
});

function ProjectRoute() {
  const { id } = Route.useParams();
  return (
    <RequireAuth>
      <ProjectView id={id} />
    </RequireAuth>
  );
}

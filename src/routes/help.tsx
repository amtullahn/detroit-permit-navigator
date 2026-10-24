import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help — Detroit Permit Navigator" },
      { name: "description", content: "What Detroit Permit Navigator does, what it doesn't, and where its information comes from." },
      { property: "og:title", content: "Help — Detroit Permit Navigator" },
      { property: "og:description", content: "How the navigator works and its limits." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Help,
});

const FAQ = [
  ["What does this tool do?", "It turns your address and project type into an ordered list of approvals, the documents each one asks for, and the offices to contact."],
  ["What doesn't it do?", "It doesn't file applications, pay fees, or schedule inspections. It doesn't replace the Development Resource Center (DRC) or a licensed architect."],
  ["Where does the information come from?", "Each step links to its source and shows when it was last verified. If a detail isn't in our sources, we say \"Not specified in source\" instead of guessing."],
  ["Who should I call first?", "For most small businesses: your DEGC District Business Liaison or the BSEED Development Resource Center at (313) 224-2372."],
];

function Help() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <p className="eyebrow">Help</p>
      <h1 className="mt-2 text-4xl font-bold">How this works</h1>
      <div className="mt-10 space-y-8">
        {FAQ.map(([q, a]) => (
          <section key={q} className="rule-amber pl-5">
            <h2 className="text-xl font-semibold">{q}</h2>
            <p className="mt-2 text-muted-foreground">{a}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

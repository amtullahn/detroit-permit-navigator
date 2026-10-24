import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// STAGE 1 MOCK agent. Streams a fixed sample answer. Makes NO model, email, or data-portal calls.
// Stage 3 replaces the body with the real tool loop via a single llm module.

const MAX_BODY = 16_000;
const WINDOW_MS = 60_000;
const LIMIT = 20;
const hits = new Map<string, number[]>();

function rateLimited(key: string) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > LIMIT;
}

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });

export const Route = createFileRoute("/api/agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const origin = request.headers.get("origin");
        if (origin && origin !== new URL(request.url).origin) return json(403, "Not allowed");

        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json(401, "Please sign in.");
        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !key) return json(500, "Something went wrong.");
        const sb = createClient(url, key, { auth: { persistSession: false } });
        const { data: userData, error } = await sb.auth.getUser(token);
        if (error || !userData.user) return json(401, "Please sign in.");

        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (rateLimited(`u:${userData.user.id}`) || rateLimited(`ip:${ip}`)) return json(429, "Too many requests. Please wait a minute.");

        const raw = await request.text();
        if (raw.length > MAX_BODY) return json(413, "Message is too long.");

        const sample =
          "Here's a **sample** answer (mock mode, no AI yet).\n\n1. Start with a pre-plan consultation at the Development Resource Center (DRC) [1].\n2. Then confirm your use with the BSEED Zoning Division [2].\n\nThis is guidance, not legal or professional advice. Rules change. Confirm with the Development Resource Center at (313) 224-2372.";
        const now = new Date().toISOString();
        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

        const stream = new ReadableStream({
          async start(controller) {
            for (const word of sample.split(/(\s+)/)) {
              controller.enqueue(send("token", { text: word }));
              await new Promise((r) => setTimeout(r, 18));
            }
            controller.enqueue(
              send("sources", {
                sources: [
                  { id: 1, title: "Development Resource Center (MOCK)", publisher: "City of Detroit", url: "https://detroitmi.gov/drc", retrieved_at: now },
                  { id: 2, title: "BSEED Permits & Plan Review (MOCK)", publisher: "City of Detroit", url: "https://detroitmi.gov/departments/buildings-safety-engineering-and-environmental-department-bseed/bseed-divisions/permits-plan-review", retrieved_at: now },
                ],
              }),
            );
            controller.enqueue(send("meta", { confidence: "medium" }));
            controller.enqueue(send("done", {}));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform" },
        });
      },
    },
  },
});

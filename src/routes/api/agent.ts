import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { llmGenerate, LlmUnavailable, type LlmContent, type LlmPart } from "@/lib/llm.server";
import { executeTool, TOOL_DECLARATIONS, type ToolSource } from "@/lib/detroit-tools.server";

// Stage 3: real agent. Tool loop over Detroit open data via Gemma (see src/lib/llm.server.ts).
// Keeps the Stage 1 guardrails: auth, origin check, rate limits, body limit, SSE format.

const MAX_BODY = 16_000;
const WINDOW_MS = 60_000;
const LIMIT = 20;
const MAX_ROUNDS = 4;
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

const GUIDANCE_NOTICE =
  "This is guidance, not legal or professional advice. Rules change. Confirm with the Development Resource Center at (313) 224-2372.";

type ChatMsg = { role: "user" | "assistant"; content: string };

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
        const sb = createClient(url, key, {
          auth: { persistSession: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: userData, error } = await sb.auth.getUser(token);
        if (error || !userData.user) return json(401, "Please sign in.");
        // User-scoped client (RLS as this user) for project context + tool-call logging.
        const sbUser = createClient(url, key, {
          auth: { persistSession: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              h.set("Authorization", `Bearer ${token}`);
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });

        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
        if (rateLimited(`u:${userData.user.id}`) || rateLimited(`ip:${ip}`)) return json(429, "Too many requests. Please wait a minute.");

        const raw = await request.text();
        if (raw.length > MAX_BODY) return json(413, "Message is too long.");

        let body: { project_id?: string; messages?: ChatMsg[] };
        try {
          body = JSON.parse(raw);
        } catch {
          return json(400, "Bad request.");
        }
        const messages = (body.messages ?? []).filter(
          (m): m is ChatMsg => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string",
        );
        if (!messages.length || messages[messages.length - 1]!.role !== "user") return json(400, "Bad request.");

        // Project context (RLS keeps it to the owner's own project).
        let contextLine = "";
        if (body.project_id) {
          const { data: proj } = await sbUser
            .from("projects")
            .select("address, parcel_id, project_type, intended_use, size")
            .eq("id", body.project_id)
            .maybeSingle();
          if (proj) {
            contextLine = `\nCurrent project: address=${proj.address ?? "unknown"}, parcel_id=${proj.parcel_id ?? "unknown"}, project_type=${proj.project_type}, intended_use=${proj.intended_use ?? "unknown"}${proj.size ? `, size=${proj.size}` : ""}. Prefer these identifiers when calling tools.`;
          }
        }

        const system = [
          "You are the Detroit Permit Navigator assistant. You help Detroit homeowners and small developers understand permitting steps.",
          "Use the provided tools for any factual claim about a parcel, zoning, permits, blockers, checklists, or contacts. Never invent addresses, requirements, fees, or office names.",
          "Every tool result includes source entries with a cite_id. Cite factual claims inline as [n] using those cite_ids. If a value is 'Not specified in source', say that plainly instead of guessing.",
          "This is not legal advice and you are not a lawyer. Recommend confirming with the listed city office when data is missing, stale, or ambiguous.",
          "Keep answers concise, plain-language, and ordered as steps when the user asks what to do.",
          `End every answer with this exact sentence on its own line: "${GUIDANCE_NOTICE}"`,
          contextLine,
        ].join("\n");

        const contents: LlmContent[] = messages
          .slice(-10)
          .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("model" as const), parts: [{ text: m.content.slice(0, 2000) }] }));

        const sources: { id: number; title: string; publisher: string; url: string; retrieved_at: string }[] = [];
        const citeId = (s: ToolSource) => {
          const found = sources.find((x) => x.title === s.title && x.url === s.url);
          if (found) return found.id;
          const id = sources.length + 1;
          sources.push({ id, title: s.title, publisher: s.publisher, url: s.url, retrieved_at: s.fetched_at });
          return id;
        };

        let answer = "";
        try {
          for (let round = 0; round < MAX_ROUNDS; round++) {
            const { parts } = await llmGenerate({ system, contents, tools: TOOL_DECLARATIONS });
            contents.push({ role: "model", parts });
            const calls = parts.filter((p): p is LlmPart & { functionCall: { name: string; args?: Record<string, unknown> } } => !!p.functionCall);
            if (!calls.length) {
              answer = parts.map((p) => p.text ?? "").join("").trim();
              break;
            }
            const responseParts: LlmPart[] = [];
            for (const c of calls) {
              const name = c.functionCall.name;
              let result: unknown;
              let ok = true;
              try {
                result = await executeTool(name, c.functionCall.args ?? {});
                if ((result as { error?: unknown })?.error) ok = false;
              } catch {
                ok = false;
                result = { error: "That lookup failed. Try again later." };
              }
              // Number this result's sources so the model can cite [n] consistently with what we show.
              const r = result as { source?: ToolSource; sources?: ToolSource[] };
              const withIds = (r.sources ?? (r.source ? [r.source] : [])).map((s) => ({ ...s, cite_id: citeId(s) }));
              // Best-effort audit log; never blocks the answer.
              sbUser.from("tool_call_log").insert({ tool_name: name, success: ok, ran_at: new Date().toISOString() }).then(() => {}, () => {});
              responseParts.push({
                functionResponse: { name, response: { result: { ...(result as Record<string, unknown>), sources: withIds } } },
              });
            }
            contents.push({ role: "function", parts: responseParts });
          }
        } catch (e) {
          if (e instanceof LlmUnavailable) return json(503, e.message);
          console.error("agent loop failed", e);
          return json(500, "Something went wrong. Please try again.");
        }

        if (!answer) answer = `I couldn't work that out from the available city data. Please contact the Development Resource Center at (313) 224-2372.\n\n${GUIDANCE_NOTICE}`;
        if (!answer.includes(GUIDANCE_NOTICE)) answer = `${answer}\n\n${GUIDANCE_NOTICE}`;

        const enc = new TextEncoder();
        const send = (event: string, data: unknown) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        const stream = new ReadableStream({
          start(controller) {
            for (let i = 0; i < answer.length; i += 48) {
              controller.enqueue(send("token", { text: answer.slice(i, i + 48) }));
            }
            controller.enqueue(send("sources", { sources }));
            controller.enqueue(send("meta", { confidence: sources.length ? "medium" : "low" }));
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

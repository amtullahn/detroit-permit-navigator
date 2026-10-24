import { createFileRoute } from "@tanstack/react-router";

// TEMPORARY debug route — delete after Stage 3 verification.
export const Route = createFileRoute("/api/llm-debug")({
  server: {
    handlers: {
      GET: async () => {
        const key = process.env["GEMMA_API_KEY"];
        if (!key) return Response.json({ error: "no key" });
        const t0 = Date.now();
        try {
          const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemma-4-31b-it:generateContent", {
            method: "POST",
            signal: AbortSignal.timeout(45_000),
            headers: { "content-type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Say OK" }] }], generationConfig: { maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } } }),
          });
          const text = await res.text();
          return Response.json({ status: res.status, ms: Date.now() - t0, body: text.slice(0, 400) });
        } catch (e) {
          return Response.json({ error: String(e), ms: Date.now() - t0 });
        }
      },
    },
  },
});

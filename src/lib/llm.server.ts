// Server-only: single module for all model calls so the provider can be swapped in one file.
// Currently Gemma 4 via the Gemini API. The key lives only in the GEMMA_API_KEY server secret
// and is never shipped to the browser (this file is *.server.ts and blocked from client bundles).

export interface LlmPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
export interface LlmContent {
  role: "user" | "model" | "function";
  parts: LlmPart[];
}
export interface LlmToolDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

const MODEL = "gemma-4-31b-it";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export class LlmUnavailable extends Error {}

export async function llmGenerate(opts: {
  system: string;
  contents: LlmContent[];
  tools?: LlmToolDeclaration[];
}): Promise<{ parts: LlmPart[] }> {
  const key = process.env["GEMMA_API_KEY"];
  if (!key) throw new LlmUnavailable("The assistant is not configured yet.");
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.contents,
    tools: opts.tools?.length ? [{ functionDeclarations: opts.tools }] : undefined,
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
  });
  // The provider occasionally returns transient 429/5xx or stalls; retry those with backoff.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const t0 = Date.now();
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: payload,
      });
    } catch (e) {
      res = null;
      console.error("llm fetch failed after", Date.now() - t0, "ms;", e);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw new LlmUnavailable("The assistant is temporarily unavailable. Please try again in a few minutes.");
    }
    if (res.ok || (res.status !== 429 && res.status < 500)) break;
    console.error("llm transient", res.status, Date.now() - t0, "ms");
    if (attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await new Promise((r) => setTimeout(r, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * (attempt + 1)));
    }
  }
  if (!res || !res.ok) {
    console.error("llm http error", res?.status, (await res?.text().catch(() => ""))?.slice(0, 500));
    throw new LlmUnavailable("The assistant is temporarily unavailable. Please try again in a few minutes.");
  }
  const j = (await res.json()) as { candidates?: { content?: { parts?: LlmPart[] } }[] };
  return { parts: j.candidates?.[0]?.content?.parts ?? [] };
}

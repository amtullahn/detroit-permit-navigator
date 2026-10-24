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
  let res: Response;
  const t0 = Date.now();
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: opts.contents,
        tools: opts.tools?.length ? [{ functionDeclarations: opts.tools }] : undefined,
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });
  } catch (e) {
    console.error("llm fetch failed after", Date.now() - t0, "ms;", e);
    throw new LlmUnavailable("The assistant is temporarily unavailable. Please try again in a few minutes.");
  }
  if (!res.ok) {
    console.error("llm http error", res.status, Date.now() - t0, "ms;", (await res.text().catch(() => "")).slice(0, 500));
    throw new LlmUnavailable("The assistant is temporarily unavailable. Please try again in a few minutes.");
  }
  console.log("llm ok", Date.now() - t0, "ms", opts.contents.length, "contents");
  const j = (await res.json()) as { candidates?: { content?: { parts?: LlmPart[] } }[] };
  return { parts: j.candidates?.[0]?.content?.parts ?? [] };
}

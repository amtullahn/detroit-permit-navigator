import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { RotateCcw, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export type ChatSource = { id: number; title: string; publisher: string; url: string; retrieved_at: string };
type Msg = { id: string; role: "user" | "assistant"; content: string; rated?: 1 | -1 };

const SUGGESTED = ["What order do I need to do these approvals in?", "Who should I contact first?", "Do I need a public hearing?"];

export function ProjectChat({
  projectId,
  onSources,
  onCite,
}: {
  projectId: string;
  onSources: (s: ChatSource[]) => void;
  onCite: (id: number | null) => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest" }), [messages]);
  useEffect(() => { if (!busy) taRef.current?.focus(); }, [busy]);

  async function send(text: string, history = messages) {
    if (!text.trim() || busy) return;
    setError(null);
    const user: Msg = { id: crypto.randomUUID(), role: "user", content: text.trim().slice(0, 2000) };
    const asst: Msg = { id: crypto.randomUUID(), role: "assistant", content: "" };
    const next = [...history, user];
    setMessages([...next, asst]);
    setInput("");
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ project_id: projectId, messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Something went wrong.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const f of frames) {
          const ev = f.match(/^event: (.*)$/m)?.[1];
          const payload = JSON.parse(f.match(/^data: (.*)$/m)?.[1] ?? "{}");
          if (ev === "token") setMessages((m) => m.map((x) => (x.id === asst.id ? { ...x, content: x.content + payload.text } : x)));
          if (ev === "sources") onSources(payload.sources);
        }
      }
    } catch (e) {
      setMessages(next);
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function rate(m: Msg, rating: 1 | -1) {
    const { error } = await supabase.from("feedback").insert({ message_id: m.id, rating });
    if (error) { toast.error("Couldn't save your feedback."); return; }
    setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, rated: rating } : x)));
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  return (
    <section aria-label="Project assistant chat" className="rounded-xl border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h2 className="font-semibold">Ask the assistant</h2>
        <Button variant="ghost" size="sm" onClick={() => { setMessages([]); onSources([]); setError(null); }} disabled={busy}>
          New conversation
        </Button>
      </div>
      <div className="max-h-[480px] min-h-[220px] space-y-5 overflow-y-auto px-5 py-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.map((s) => (
              <button key={s} onClick={() => send(s)} className="rounded-full border px-4 py-2 text-sm transition hover:border-accent hover:bg-amber-soft">
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">{m.content}</div>
          ) : (
            <div key={m.id} className="max-w-[92%]">
              {m.content ? (
                <div className="prose-sm space-y-3 [&_a]:text-primary [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p>{withCitations(children, onCite)}</p>,
                      li: ({ children }) => <li>{withCitations(children, onCite)}</li>,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <TypingDots />
              )}
              {m.content && !busy && (
                <div className="mt-2 flex gap-1" role="group" aria-label="Rate this answer">
                  <Button variant="ghost" size="icon" aria-label="Helpful" aria-pressed={m.rated === 1} onClick={() => rate(m, 1)} disabled={!!m.rated}>
                    <ThumbsUp className={m.rated === 1 ? "text-success" : ""} />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Not helpful" aria-pressed={m.rated === -1} onClick={() => rate(m, -1)} disabled={!!m.rated}>
                    <ThumbsDown className={m.rated === -1 ? "text-destructive" : ""} />
                  </Button>
                </div>
              )}
            </div>
          ),
        )}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <span>{error}</span>
            {lastUser && (
              <Button size="sm" variant="outline" onClick={() => send(lastUser.content, messages.slice(0, messages.lastIndexOf(lastUser)))}>
                <RotateCcw /> Retry
              </Button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form className="flex items-end gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <Textarea
          ref={taRef}
          aria-label="Your question"
          rows={2}
          maxLength={2000}
          placeholder="Ask about your checklist…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          className="min-h-0 resize-none"
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={busy || !input.trim()} className="h-10 w-10 shrink-0">
          <Send />
        </Button>
      </form>
    </section>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-2" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

function withCitations(children: React.ReactNode, onCite: (id: number | null) => void): React.ReactNode {
  const walk = (c: React.ReactNode): React.ReactNode => {
    if (typeof c !== "string") return Array.isArray(c) ? c.map((x, i) => <span key={i}>{walk(x)}</span>) : c;
    return c.split(/(\[\d+\])/).map((part, i) => {
      const n = part.match(/^\[(\d+)\]$/)?.[1];
      if (!n) return part;
      return (
        <button
          key={i}
          type="button"
          aria-label={`Source ${n}`}
          onMouseEnter={() => onCite(+n)}
          onMouseLeave={() => onCite(null)}
          onFocus={() => onCite(+n)}
          onBlur={() => onCite(null)}
          onClick={() => onCite(+n)}
          className="mx-0.5 rounded bg-amber-soft px-1 font-mono text-xs text-primary"
        >
          [{n}]
        </button>
      );
    });
  };
  return walk(children);
}

import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { glossaryQuery } from "@/lib/reference";

/** Wraps known glossary terms in plain text with hover/focus tooltips. */
export function GlossaryText({ text }: { text: string }) {
  const { data } = useQuery(glossaryQuery);
  const { regex, map } = useMemo(() => {
    const terms = (data ?? []).map((g) => g.term).sort((a, b) => b.length - a.length);
    const map = new Map((data ?? []).map((g) => [g.term.toLowerCase(), g.definition]));
    if (!terms.length) return { regex: null, map };
    const esc = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return { regex: new RegExp(`\\b(${esc.join("|")})\\b`, "gi"), map };
  }, [data]);
  if (!regex) return <>{text}</>;
  const parts = text.split(regex);
  return (
    <>
      {parts.map((p, i) => {
        const def = map.get(p.toLowerCase());
        if (!def) return <Fragment key={i}>{p}</Fragment>;
        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="cursor-help border-b border-dotted border-accent">
                {p}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-sm">{def}</TooltipContent>
          </Tooltip>
        );
      })}
    </>
  );
}

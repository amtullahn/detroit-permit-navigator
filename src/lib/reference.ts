import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const GUIDANCE_NOTICE =
  "This is guidance, not legal or professional advice. Rules change. Confirm with the Development Resource Center at (313) 224-2372.";
export const NOT_SPECIFIED = "Not specified in source";

export const glossaryQuery = queryOptions({
  queryKey: ["glossary"],
  queryFn: async () => {
    const { data, error } = await supabase.from("glossary").select("*").order("term");
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60_000,
});

export const contactsQuery = queryOptions({
  queryKey: ["contacts"],
  queryFn: async () => {
    const { data, error } = await supabase.from("contacts").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const firmsQuery = queryOptions({
  queryKey: ["firms"],
  queryFn: async () => {
    const { data, error } = await supabase.from("architecture_firms").select("*").order("name");
    if (error) throw error;
    return data;
  },
});

export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: async () => {
    const { data, error } = await supabase.from("config").select("*");
    if (error) throw error;
    return Object.fromEntries(data.map((r) => [r.key, r.value])) as Record<string, unknown>;
  },
});

export function isStale(lastVerified: string | null, staleDays: number) {
  if (!lastVerified) return true;
  return Date.now() - new Date(lastVerified).getTime() > staleDays * 86_400_000;
}

export function verifiedLabel(d: string | null) {
  return d ? `Last verified on ${new Date(d).toLocaleDateString()}` : "Pending re-verification";
}

export const PROJECT_TYPES = [
  { value: "new_build", label: "New build" },
  { value: "alteration", label: "Alteration" },
  { value: "change_of_use", label: "Change of use" },
  { value: "industrial", label: "Industrial" },
] as const;

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Detroit Permit Navigator" },
      { name: "description", content: "Sign in with a one-time email link to save your Detroit permit projects." },
      { property: "og:title", content: "Sign in — Detroit Permit Navigator" },
      { property: "og:description", content: "Sign in with an email link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"link" | "password">("link");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setState("error");
      } else {
        navigate({ to: "/projects" });
      }
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/projects` },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <p className="eyebrow">Sign in</p>
      <h1 className="mt-2 text-3xl font-bold">We'll email you a link</h1>
      <p className="mt-2 text-muted-foreground">
        {mode === "link" ? "No password needed. Your projects stay private to your account." : "Sign in with your email and password."}
      </p>
      {state === "sent" ? (
        <div role="status" className="mt-8 rounded-lg border bg-amber-soft p-5">
          <Mail className="h-5 w-5 text-primary" aria-hidden />
          <p className="mt-2 font-medium">Check your inbox for {email}.</p>
          <p className="text-sm text-muted-foreground">Open the link on this device to sign in. Check spam if you don't see it.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
          </div>
          {mode === "password" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" autoComplete="current-password" />
            </div>
          )}
          {state === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {mode === "password" ? "We couldn't sign you in. Check your email and password and try again." : "We couldn't send the link. Please try again in a minute."}
            </p>
          )}
          <Button type="submit" className="h-11 w-full" disabled={state === "sending"}>
            {state === "sending" ? (mode === "password" ? "Signing in…" : "Sending…") : mode === "password" ? "Sign in" : "Email me a sign-in link"}
          </Button>
          <button
            type="button"
            onClick={() => { setMode(mode === "link" ? "password" : "link"); setState("idle"); }}
            className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {mode === "link" ? "Sign in with password instead" : "Sign in with an email link instead"}
          </button>
        </form>
      )}
    </div>
  );
}

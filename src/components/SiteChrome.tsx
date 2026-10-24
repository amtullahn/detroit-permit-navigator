import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GUIDANCE_NOTICE } from "@/lib/reference";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/projects", label: "My Projects" },
  { to: "/map", label: "Map" },
  { to: "/contacts", label: "Contacts" },
  { to: "/glossary", label: "Glossary" },
  { to: "/help", label: "Help" },
] as const;

export function SiteHeader() {
  const { session, isAdmin } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <span aria-hidden className="inline-block h-5 w-1.5 rounded-sm bg-accent" />
          Detroit Permit Navigator
        </Link>
        <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/" }}
              className="rounded-md px-3 py-1.5 text-[0.95rem] text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-semibold data-[status=active]:text-primary"
            >
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className="rounded-md px-3 py-1.5 text-[0.95rem] text-muted-foreground hover:text-foreground data-[status=active]:text-primary">
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto">
          {session ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
            >
              Sign out
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-primary text-primary-foreground">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="eyebrow !text-accent">Guidance only</p>
        <p className="mt-2 max-w-2xl text-[0.95rem] opacity-90">{GUIDANCE_NOTICE}</p>
        <p className="mt-6 text-sm opacity-60">Detroit only · Does not file applications, pay fees, or schedule inspections.</p>
      </div>
    </footer>
  );
}

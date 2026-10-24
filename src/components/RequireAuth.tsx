import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <p className="py-20 text-center text-muted-foreground">Loading…</p>;
  if (!session)
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold">Sign in to continue</h1>
        <p className="mt-2 text-muted-foreground">Your projects are private to your account.</p>
        <Button asChild className="mt-6">
          <Link to="/login">Sign in with email</Link>
        </Button>
      </div>
    );
  if (admin && !isAdmin)
    return <p className="py-20 text-center text-muted-foreground">This page is for administrators only.</p>;
  return <>{children}</>;
}

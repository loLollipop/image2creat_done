"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { UserRole } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";

interface AuthGuardProps {
  /** When set, the user must hold this exact role (or "admin" implies "user"). */
  role?: UserRole;
  children: React.ReactNode;
}

/**
 * Client-side guard: redirects to /login when no session is present
 * and (optionally) bounces non-admin users away from admin pages.
 */
export function AuthGuard({ role, children }: AuthGuardProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role === "admin" && user.role !== "admin") {
      router.replace("/create");
    }
  }, [loading, user, role, router]);

  if (loading || !user || (role === "admin" && user.role !== "admin")) {
    return (
      <div className="flex h-[40vh] items-center justify-center text-sm text-stone-400">
        载入中…
      </div>
    );
  }
  return <>{children}</>;
}

"use client";

import { useEffect } from "react";

import { fetchMe } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";

/**
 * Bootstraps the auth store from `/api/auth/me` exactly once at mount.
 * Any subsequent component can subscribe via `useAuthStore`.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setSession = useAuthStore((s) => s.setSession);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        setSession(data);
      })
      .catch(() => {
        if (cancelled) return;
        setSession({
          user: null,
          firstRun: false,
          checkin: { checkedInToday: false, credit: 1 },
          settings: {
            hasApiKey: false,
            model: "",
            activeUpstream: "chatgpt2api",
            allowRegistration: true,
            requireApproval: false,
            defaultCredits: 10,
            generationCreditCost: 1,
            checkinCredit: 1,
            maxImagesPerRequest: 1,
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [setLoading, setSession]);

  return <>{children}</>;
}

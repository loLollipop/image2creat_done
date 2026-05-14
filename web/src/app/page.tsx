"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { defaultRouteForRole } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading) return;
    router.replace(user ? defaultRouteForRole(user.role) : "/login");
  }, [loading, user, router]);

  return (
    <div className="flex h-[50vh] items-center justify-center text-sm text-stone-400">
      正在跳转…
    </div>
  );
}

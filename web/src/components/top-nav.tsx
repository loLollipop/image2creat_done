"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Coins,
  Image as ImageIcon,
  LogOut,
  Settings2,
  Sparkles,
  UserCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { logout, type UserRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

interface NavItem {
  href: string;
  label: string;
  roles: UserRole[];
  /** Hide on small screens to keep the bar usable; only the most
   *  important entries stay visible below `sm:`. */
  primary?: boolean;
}

const userNav: NavItem[] = [
  { href: "/create", label: "画图", roles: ["user", "admin"], primary: true },
  { href: "/library", label: "提示词库", roles: ["user", "admin"] },
  { href: "/square", label: "广场", roles: ["user", "admin"] },
  { href: "/works", label: "我的作品", roles: ["user", "admin"], primary: true },
];

const adminNav: NavItem[] = [
  { href: "/admin/dashboard", label: "仪表盘", roles: ["admin"], primary: true },
  { href: "/admin/users", label: "用户与积分", roles: ["admin"], primary: true },
  { href: "/admin/generations", label: "生图记录", roles: ["admin"] },
  { href: "/admin/accounts", label: "号池与注册机", roles: ["admin"] },
  { href: "/admin/upstream", label: "上游与备份", roles: ["admin"] },
  { href: "/admin/settings", label: "接口设置", roles: ["admin"] },
];

export function TopNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const reset = useAuthStore((s) => s.reset);

  const hideOn = pathname === "/login" || pathname === "/register";
  if (hideOn) return null;
  if (loading) {
    return (
      <header className="border-b border-stone-200/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center px-4 sm:px-6">
          <span className="text-sm text-stone-400">载入中…</span>
        </div>
      </header>
    );
  }

  const isAdminSection = pathname.startsWith("/admin");
  const navItems = isAdminSection && user?.role === "admin" ? adminNav : userNav;

  const handleLogout = async () => {
    try {
      await logout();
      reset();
      toast.success("已退出登录");
      router.replace("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "退出失败");
    }
  };

  return (
    <header className="border-b border-stone-200/60 bg-white/70 backdrop-blur">
      <div className="mx-auto flex min-h-12 max-w-7xl flex-col gap-2 px-4 py-2 sm:h-12 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-0">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={user ? (user.role === "admin" ? "/admin/dashboard" : "/create") : "/login"}
            className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight text-stone-950 transition hover:text-stone-700"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-white">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            Image Studio
          </Link>

          <div className="flex items-center gap-2 sm:hidden">
            {user ? (
              <Link
                href="/credits"
                className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-700"
              >
                <Coins className="h-3.5 w-3.5" />
                {user.credits}
              </Link>
            ) : null}
          </div>
        </div>

        <nav className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1 text-sm text-stone-600">
          {navItems
            .filter((item) => !user || item.roles.includes(user.role))
            .map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 transition",
                    active
                      ? "bg-stone-900 text-white shadow-sm"
                      : "hover:bg-stone-100 hover:text-stone-900",
                    !item.primary && "hidden sm:inline-flex",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          {user?.role === "admin" && !isAdminSection ? (
            <Link
              href="/admin/dashboard"
              className="ml-auto hidden shrink-0 items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-stone-600 transition hover:border-stone-300 hover:text-stone-900 sm:inline-flex"
            >
              <Settings2 className="h-3.5 w-3.5" /> 后台
            </Link>
          ) : null}
          {user?.role === "admin" && isAdminSection ? (
            <Link
              href="/create"
              className="ml-auto hidden shrink-0 items-center gap-1 rounded-full border border-stone-200 px-3 py-1.5 text-stone-600 transition hover:border-stone-300 hover:text-stone-900 sm:inline-flex"
            >
              <ImageIcon className="h-3.5 w-3.5" /> 返回前台
            </Link>
          ) : null}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          {user ? (
            <>
              <Link
                href="/credits"
                className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-sm text-stone-700 transition hover:border-stone-300 hover:text-stone-900"
                title="积分中心"
              >
                <Coins className="h-3.5 w-3.5" />
                {user.credits}
              </Link>
              <span className="inline-flex items-center gap-1.5 text-sm text-stone-500">
                <UserCircle2 className="h-4 w-4" />
                {user.name || user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="mr-1 h-3.5 w-3.5" />
                退出
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => router.push("/login")}>
              登录
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

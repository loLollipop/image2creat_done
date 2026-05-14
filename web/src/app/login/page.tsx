"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultRouteForRole, fetchMe, login } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const settings = useAuthStore((s) => s.settings);

  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ defaultValues: { email: "", password: "" } });

  // Bounce out if already signed in.
  useEffect(() => {
    if (!loading && user) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [loading, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const { user: signedIn } = await login(values.email.trim(), values.password);
      // Refresh full session state from /api/auth/me so credits / settings
      // line up with the server view.
      const me = await fetchMe();
      setSession(me);
      toast.success(`欢迎回来，${signedIn.name || signedIn.email}`);
      router.replace(defaultRouteForRole(signedIn.role));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <div className="mb-6 flex items-center justify-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-900 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
      </div>
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold tracking-tight text-stone-950">登录</h1>
          <p className="text-sm text-stone-500">使用账号密码登录 GPT Image Studio。</p>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                disabled={submitting}
                {...register("email", { required: "请填写邮箱" })}
              />
              {errors.email ? (
                <span className="text-xs text-red-600">{errors.email.message}</span>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={submitting}
                {...register("password", { required: "请填写密码" })}
              />
              {errors.password ? (
                <span className="text-xs text-red-600">{errors.password.message}</span>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              登录
            </Button>
            {settings?.allowRegistration ? (
              <p className="text-center text-xs text-stone-500">
                还没有账号？
                <Link href="/register" className="ml-1 text-stone-900 underline-offset-4 hover:underline">
                  立即注册
                </Link>
              </p>
            ) : null}
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

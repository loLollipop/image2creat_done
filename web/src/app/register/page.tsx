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
import { defaultRouteForRole, fetchMe, register as registerApi } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";

interface RegisterForm {
  name: string;
  email: string;
  password: string;
}

export default function RegisterPage() {
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
  } = useForm<RegisterForm>({
    defaultValues: { name: "", email: "", password: "" },
  });

  useEffect(() => {
    if (!loading && user) {
      router.replace(defaultRouteForRole(user.role));
    }
  }, [loading, user, router]);

  // Hard-block registration if the backend has disabled it.
  useEffect(() => {
    if (!loading && settings && !settings.allowRegistration) {
      toast.error("注册已关闭");
      router.replace("/login");
    }
  }, [loading, settings, router]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const result = await registerApi(
        values.email.trim(),
        values.password,
        values.name.trim() || undefined,
      );
      if (result.pendingApproval) {
        toast.info("注册成功，待管理员审核后可登录");
        router.replace("/login");
        return;
      }
      const me = await fetchMe();
      setSession(me);
      toast.success("注册成功");
      router.replace(defaultRouteForRole(result.user.role));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "注册失败");
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
          <h1 className="text-xl font-semibold tracking-tight text-stone-950">创建账号</h1>
          <p className="text-sm text-stone-500">
            注册即赠送 {settings?.defaultCredits ?? 10} 积分，可立即开始生成图片。
          </p>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">昵称（可选）</Label>
              <Input id="name" disabled={submitting} {...register("name")} />
            </div>
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
                autoComplete="new-password"
                placeholder="至少 8 个字符"
                disabled={submitting}
                {...register("password", {
                  required: "请填写密码",
                  minLength: { value: 8, message: "密码至少 8 个字符" },
                })}
              />
              {errors.password ? (
                <span className="text-xs text-red-600">{errors.password.message}</span>
              ) : null}
            </div>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              注册
            </Button>
            <p className="text-center text-xs text-stone-500">
              已有账号？
              <Link href="/login" className="ml-1 text-stone-900 underline-offset-4 hover:underline">
                直接登录
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

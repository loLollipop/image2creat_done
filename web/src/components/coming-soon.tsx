import { Sparkles } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

interface ComingSoonProps {
  kicker?: string;
  title: string;
  description?: string;
  phase?: string;
  /** Optional list of legacy admin / frontend features that will land here. */
  features?: string[];
}

/**
 * Placeholder shown while a page is still being migrated from the
 * legacy `public/admin.html` / `public/index.html` codebase to the
 * new Next.js frontend.  Subsequent PRs (P1..P6) replace these with
 * the real implementations.
 */
export function ComingSoon({
  kicker,
  title,
  description,
  phase,
  features,
}: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <PageHeader kicker={kicker} title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center text-sm text-stone-500">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-stone-900/5 text-stone-500">
            <Sparkles className="h-4 w-4" />
          </span>
          <p className="font-medium text-stone-700">
            该页面正在迁移到新版前端。
          </p>
          {phase ? (
            <p>
              计划在 <span className="font-medium text-stone-800">{phase}</span> 阶段交付。
            </p>
          ) : null}
          {features?.length ? (
            <ul className="mt-2 list-inside list-disc text-left text-xs text-stone-500">
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-xs text-stone-400">
            老版本入口暂时仍可通过 <code>/legacy</code>（即原始的{" "}
            <code>public/index.html</code> 和 <code>public/admin.html</code>）访问。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

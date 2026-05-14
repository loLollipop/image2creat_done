import { cn } from "@/lib/utils";

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        {kicker ? (
          <span className="inline-flex rounded-full bg-stone-900/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-stone-500">
            {kicker}
          </span>
        ) : null}
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-[26px]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-prose text-sm text-stone-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

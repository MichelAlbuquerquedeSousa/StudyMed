import clsx from "clsx";
import Link from "next/link";

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={clsx("rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-soft", className)} {...rest}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  icon,
  href,
  hrefLabel = "Ver tudo",
}: {
  title: string;
  icon?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
        {icon}
        {title}
      </h2>
      {href && (
        <Link href={href} className="rounded-full px-3 py-1.5 text-sm font-medium text-accent hover:bg-surface-2">
          {hrefLabel}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-8 text-center">
      <div className="text-muted">{icon}</div>
      <p className="font-medium">{title}</p>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[1.9rem] leading-tight font-medium tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-2xl bg-surface-2", className)} />;
}

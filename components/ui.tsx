import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-coral)]">
            {eyebrow}
          </p>
        ) : null}
        <div>
          <h2 className="text-2xl font-semibold text-[var(--brand-text-primary)]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--brand-text-secondary)]">{description}</p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)] p-5 shadow-[var(--brand-shadow)] backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger" | "success";
  hint?: string;
}) {
  const toneClass =
    tone === "danger"
      ? "border-[var(--brand-border-strong)] bg-[var(--brand-coral-soft)]"
      : tone === "warning"
        ? "border-[rgba(0,143,135,0.22)] bg-[var(--brand-cyan-soft)]"
        : tone === "success"
          ? "border-[rgba(0,143,135,0.22)] bg-[var(--brand-cyan-soft)]"
          : "border-[var(--brand-border)] bg-[var(--brand-surface-strong)]";

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", toneClass)}>
      <p className="text-sm text-[var(--brand-text-muted)]">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-[var(--brand-text-primary)]">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[var(--brand-text-secondary)]">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({
  status,
}: {
  status: "ok" | "warning" | "error" | "new" | "saved" | "applied" | "dismissed" | "requires_setup";
}) {
  const tone =
    status === "ok" || status === "applied"
      ? "bg-[var(--brand-cyan-soft)] text-[var(--brand-cyan-strong)]"
      : status === "warning" || status === "saved" || status === "requires_setup"
        ? "bg-[var(--brand-surface-muted)] text-[var(--brand-text-secondary)]"
        : status === "new"
          ? "bg-[rgba(0,143,135,0.14)] text-[var(--brand-cyan)]"
          : "bg-[var(--brand-coral-soft)] text-[var(--brand-coral-strong)]";

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase", tone)}>
      {status.replace("_", " ")}
    </span>
  );
}

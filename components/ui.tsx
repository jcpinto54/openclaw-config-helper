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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {eyebrow}
          </p>
        ) : null}
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>
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
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", className)}>
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
      ? "border-rose-200 bg-rose-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white";

  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm", toneClass)}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-600">{hint}</p> : null}
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
      ? "bg-emerald-100 text-emerald-800"
      : status === "warning" || status === "saved" || status === "requires_setup"
        ? "bg-amber-100 text-amber-800"
        : status === "new"
          ? "bg-sky-100 text-sky-800"
          : "bg-rose-100 text-rose-800";

  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold uppercase", tone)}>
      {status.replace("_", " ")}
    </span>
  );
}

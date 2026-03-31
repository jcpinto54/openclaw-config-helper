"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-[var(--brand-coral)] text-white shadow-sm"
          : "text-[var(--brand-text-secondary)] hover:bg-[var(--brand-surface-muted)] hover:text-[var(--brand-text-primary)]",
      )}
    >
      {label}
    </Link>
  );
}

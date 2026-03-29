import type { ReactNode } from "react";

import { NavLink } from "@/components/nav-link";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/config", label: "Config" },
  { href: "/audit", label: "Audit" },
  { href: "/credentials", label: "Credentials" },
  { href: "/suggestions", label: "Suggestions" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
                OpenClaw Config Helper
              </p>
              <h1 className="text-3xl font-semibold text-slate-950">
                Configuration management, auditing, and suggestions
              </h1>
              <p className="max-w-3xl text-sm text-slate-600">
                A spec-driven control plane for inspecting OpenClaw config, tightening security,
                migrating secrets, and surfacing useful automations.
              </p>
            </div>
            <nav className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} />
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

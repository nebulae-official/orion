"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import {
  BarChart3,
  LayoutDashboard,
  ListVideo,
  TrendingUp,
  Settings,
  Activity,
  Play,
  LogOut,
  Send,
  Sparkles,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Content Queue", href: "/queue", icon: <ListVideo className="h-5 w-5" /> },
  { label: "Trends", href: "/trends", icon: <TrendingUp className="h-5 w-5" /> },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "Publishing", href: "/publishing", icon: <Send className="h-5 w-5" /> },
  { label: "Generation", href: "/generation", icon: <Play className="h-5 w-5" /> },
  { label: "System Health", href: "/system", icon: <Activity className="h-5 w-5" /> },
  { label: "Settings", href: "/settings", icon: <Settings className="h-5 w-5" /> },
];

export function MobileSidebarToggle({
  onClick,
}: {
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="fixed left-4 top-4 z-40 rounded-lg border border-border bg-surface p-2 text-text-secondary shadow-md transition-colors hover:bg-surface-hover md:hidden"
      aria-label="Open navigation menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-[family-name:var(--font-display)] text-lg font-bold text-text">
            Orion
          </span>
          <span className="rounded-full bg-primary-surface px-2 py-0.5 text-xs font-medium text-primary-light">
            v1.0
          </span>
        </Link>
        {/* Close button for mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="text-text-dim hover:text-text-secondary md:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive(item.href)
                ? "bg-primary-surface text-primary-light shadow-[inset_0_0_0_1px_rgba(124,58,237,0.2)]"
                : "text-text-secondary hover:bg-surface-hover hover:text-text"
            )}
          >
            <span className={cn(
              isActive(item.href) ? "text-primary-light" : "text-text-muted"
            )}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-all duration-200 hover:bg-danger-surface hover:text-danger-light"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <MobileSidebarToggle onClick={() => setMobileOpen(true)} />

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - desktop: always visible, mobile: overlay */}
      <aside
        className={cn(
          "flex h-screen w-64 flex-col border-r border-border bg-surface",
          // Mobile: fixed overlay with transition
          "fixed inset-y-0 left-0 z-50 transform transition-transform duration-300 md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

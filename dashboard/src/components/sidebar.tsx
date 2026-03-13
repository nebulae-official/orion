"use client";

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

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-surface">
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-border px-6">
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
    </aside>
  );
}

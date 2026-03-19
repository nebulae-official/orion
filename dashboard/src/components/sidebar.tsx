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
  Sparkles,
  LogOut,
  Send,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const MAIN_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Content Queue", href: "/queue", icon: <ListVideo className="h-5 w-5" /> },
  { label: "Trends", href: "/trends", icon: <TrendingUp className="h-5 w-5" /> },
  { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-5 w-5" /> },
  { label: "Publishing", href: "/publishing", icon: <Send className="h-5 w-5" /> },
  { label: "Generation", href: "/generation", icon: <Sparkles className="h-5 w-5" /> },
];

const FOOTER_NAV_ITEMS: NavItem[] = [
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
      className="fixed left-4 top-4 z-40 rounded-lg border border-violet-500/10 bg-slate-950/40 backdrop-blur-xl p-2 text-slate-400 shadow-md transition-colors hover:text-slate-200 md:hidden"
      aria-label="Open navigation menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  );
}

function NavLink({
  item,
  active,
}: {
  item: NavItem;
  active: boolean;
}): React.ReactElement {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 py-3 font-[family-name:var(--font-display)] text-sm tracking-tight transition-all duration-300",
        "px-4 md:px-2 md:justify-center lg:px-4 lg:justify-start",
        active
          ? "text-violet-300 bg-violet-500/10 rounded-lg border-l-2 border-violet-400"
          : "text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-lg"
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      <span className="md:hidden lg:inline">{item.label}</span>
    </Link>
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
      {/* Brand Header */}
      <div className="mb-12 px-4 md:px-0 md:text-center lg:px-4 lg:text-left">
        <Link href="/" className="block">
          <h1 className="text-2xl md:text-lg lg:text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-br from-violet-300 to-cyan-400 font-[family-name:var(--font-display)]">
            <span className="md:hidden lg:inline">ORION</span>
            <span className="hidden md:inline lg:hidden">O</span>
          </h1>
          <p className="font-[family-name:var(--font-display)] uppercase tracking-widest text-[10px] text-slate-400 mt-1 md:hidden lg:block">
            Digital Twin Systems
          </p>
        </Link>
        {/* Close button for mobile */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute right-4 top-6 text-slate-400 hover:text-slate-200 md:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1">
        {MAIN_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
          />
        ))}
      </nav>

      {/* Footer Navigation */}
      <div className="pt-6 border-t border-white/5 space-y-1">
        {FOOTER_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={isActive(item.href)}
          />
        ))}
      </div>

      {/* Sign Out */}
      <div className="pt-4">
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 py-3 font-[family-name:var(--font-display)] text-sm tracking-tight text-slate-400 transition-all duration-300 hover:text-slate-200 hover:bg-white/5 rounded-lg px-4 md:px-2 md:justify-center lg:px-4 lg:justify-start"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="md:hidden lg:inline">Sign out</span>
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

      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-screen flex-col z-50",
          "w-72 md:w-20 lg:w-72",
          "p-6 md:p-3 lg:p-6",
          "bg-slate-950/40 backdrop-blur-xl",
          "border-r border-violet-500/10",
          "shadow-[20px_0_50px_rgba(124,58,237,0.06)]",
          // Mobile: hidden off-screen; tablet+: always visible
          "fixed inset-y-0 left-0 transform transition-all duration-300 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

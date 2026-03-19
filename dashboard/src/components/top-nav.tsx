"use client";

import { Search, Bell, CircleUser } from "lucide-react";

export function TopNav(): React.ReactElement {
  return (
    <header className="fixed top-0 right-0 w-full md:w-[calc(100%-5rem)] lg:w-[calc(100%-18rem)] h-16 flex justify-between items-center px-4 md:px-8 z-40 bg-transparent backdrop-blur-md">
      {/* Left: System label — offset on mobile to avoid hamburger button */}
      <div className="flex items-center pl-12 md:pl-0">
        <span className="font-[family-name:var(--font-display)] uppercase tracking-widest text-[10px] text-violet-300">
          Orion OS
        </span>
      </div>

      {/* Right: Search + actions */}
      <div className="flex items-center gap-6">
        {/* Search input */}
        <div className="relative group hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="SEARCH SYSTEM..."
            className="bg-[var(--ds-surface-container-lowest)] border-none rounded-full pl-10 pr-4 py-1.5 text-[10px] font-[family-name:var(--font-display)] tracking-wider text-[var(--ds-on-surface)] placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[var(--ds-primary-container)] w-64 transition-all"
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-4 text-slate-400">
          <button
            className="hover:text-violet-300 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
          <button
            className="hover:text-violet-300 transition-colors"
            aria-label="User profile"
          >
            <CircleUser className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

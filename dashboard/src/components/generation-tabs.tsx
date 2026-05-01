"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GitBranch, ImageIcon, Film } from "lucide-react";

interface Tab {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { label: "Pipeline", href: "/generation/pipeline", icon: <GitBranch className="h-4 w-4" /> },
  { label: "Media Assets", href: "/generation/media", icon: <ImageIcon className="h-4 w-4" /> },
  { label: "Video Assembly", href: "/generation/video", icon: <Film className="h-4 w-4" /> },
];

export function GenerationTabs(): React.ReactElement {
  const pathname = usePathname();

  return (
    <div className="flex gap-0 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-5 py-2.5 font-[family-name:var(--font-label)] text-xs font-medium uppercase tracking-[0.08em] transition-colors -mb-px",
              isActive
                ? "border-primary text-primary-light"
                : "border-transparent text-text-secondary hover:text-text"
            )}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

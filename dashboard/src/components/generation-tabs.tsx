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
  { label: "Media", href: "/generation/media", icon: <ImageIcon className="h-4 w-4" /> },
  { label: "Video", href: "/generation/video", icon: <Film className="h-4 w-4" /> },
];

export function GenerationTabs(): React.ReactElement {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-border">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
              "border-b-2 -mb-px",
              isActive
                ? "border-violet-400 text-violet-300"
                : "border-transparent text-text-muted hover:text-text-secondary hover:border-text-dim"
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

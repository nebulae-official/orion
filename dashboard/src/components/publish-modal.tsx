"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { publishContent } from "@/lib/actions";

interface PublishModalProps {
  contentId: string;
  onClose: () => void;
}

const PLATFORMS = [
  { id: "twitter", label: "X / Twitter", icon: "𝕏" },
];

export function PublishModal({
  contentId,
  onClose,
}: PublishModalProps): React.ReactElement {
  const { toast } = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  function togglePlatform(id: string): void {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handlePublish(): void {
    if (selected.length === 0) {
      toast("error", "Select at least one platform");
      return;
    }

    startTransition(async () => {
      const result = await publishContent(contentId, selected);
      if (result.success) {
        toast("success", "Content published successfully");
        onClose();
      } else {
        toast("error", result.error ?? "Failed to publish");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Publish Content
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Select platforms to publish to:
        </p>

        <div className="space-y-2">
          {PLATFORMS.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
                selected.includes(p.id)
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => togglePlatform(p.id)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-lg">{p.icon}</span>
              <span className="text-sm font-medium text-gray-900">
                {p.label}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={isPending || selected.length === 0}
            className={cn(
              "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700",
              (isPending || selected.length === 0) &&
                "cursor-not-allowed opacity-60"
            )}
          >
            {isPending ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}

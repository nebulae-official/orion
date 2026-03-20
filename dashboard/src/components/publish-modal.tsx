"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { publishContent } from "@/lib/actions";
import { Modal } from "@/components/ui/modal";

interface PublishModalProps {
  contentId: string;
  onClose: () => void;
}

const PLATFORMS = [
  { id: "twitter", label: "X / Twitter", icon: "\u{1D54F}" },
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
    <Modal isOpen={true} onClose={onClose} title="Publish Content">
      <p className="mb-4 mt-4 text-sm text-text-secondary">
        Select platforms to publish to:
      </p>

      <div className="space-y-2">
        {PLATFORMS.map((p) => (
          <label
            key={p.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
              selected.includes(p.id)
                ? "border-primary bg-primary-surface"
                : "border-border hover:bg-surface-hover"
            )}
          >
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => togglePlatform(p.id)}
              className="h-4 w-4 rounded border-border bg-surface-elevated text-primary focus:ring-primary"
            />
            <span className="text-lg">{p.icon}</span>
            <span className="text-sm font-medium text-text">
              {p.label}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
        >
          Cancel
        </button>
        <button
          onClick={handlePublish}
          disabled={isPending || selected.length === 0}
          className={cn(
            "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-muted",
            (isPending || selected.length === 0) &&
              "cursor-not-allowed opacity-60"
          )}
        >
          {isPending ? "Publishing..." : "Publish"}
        </button>
      </div>
    </Modal>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { approveContent, rejectContent } from "@/lib/actions";
import type { ContentStatus } from "@/types/api";
import { CheckCircle, XCircle, RotateCcw, X, Send } from "lucide-react";
import { PublishModal } from "@/components/publish-modal";

interface ContentActionsProps {
  contentId: string;
  status: ContentStatus;
}

export function ContentActions({
  contentId,
  status,
}: ContentActionsProps): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(status);

  const canApprove = optimisticStatus === "review" || optimisticStatus === "draft";
  const canReject = optimisticStatus === "review" || optimisticStatus === "draft";
  const canPublish = optimisticStatus === "approved";

  function handleApprove(): void {
    setOptimisticStatus("approved");
    startTransition(async () => {
      const result = await approveContent(contentId);
      if (result.success) {
        toast("success", "Content approved successfully");
        router.refresh();
      } else {
        setOptimisticStatus(status);
        toast("error", result.error ?? "Failed to approve content");
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-success/80",
              isPending && "cursor-not-allowed opacity-60"
            )}
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </button>
        )}

        {canReject && (
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={isPending}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-danger/80",
              isPending && "cursor-not-allowed opacity-60"
            )}
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        )}

        {optimisticStatus === "approved" && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-light">
            <CheckCircle className="h-4 w-4" />
            Approved
          </span>
        )}

        {canPublish && (
          <button
            onClick={() => setShowPublishModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-muted"
          >
            <Send className="h-4 w-4" />
            Publish
          </button>
        )}

        {optimisticStatus === "rejected" && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-danger-light">
            <XCircle className="h-4 w-4" />
            Rejected
          </span>
        )}
      </div>

      {showRejectModal && (
        <RejectModal
          contentId={contentId}
          originalStatus={status}
          onClose={() => setShowRejectModal(false)}
          onStatusChange={setOptimisticStatus}
        />
      )}

      {showPublishModal && (
        <PublishModal
          contentId={contentId}
          onClose={() => setShowPublishModal(false)}
        />
      )}
    </>
  );
}

function RejectModal({
  contentId,
  originalStatus,
  onClose,
  onStatusChange,
}: {
  contentId: string;
  originalStatus: ContentStatus;
  onClose: () => void;
  onStatusChange: (status: ContentStatus) => void;
}): React.ReactElement {
  const router = useRouter();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [regenerate, setRegenerate] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(): void {
    if (!reason.trim()) {
      toast("error", "Please provide a reason for rejection");
      return;
    }

    onStatusChange("rejected");
    onClose();

    startTransition(async () => {
      const result = await rejectContent(contentId, {
        reason: reason.trim(),
        regenerate,
      });
      if (result.success) {
        toast(
          "success",
          regenerate
            ? "Content rejected and queued for regeneration"
            : "Content rejected"
        );
        router.refresh();
      } else {
        onStatusChange(originalStatus);
        toast("error", result.error ?? "Failed to reject content");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">
            Reject Content
          </h2>
          <button
            onClick={onClose}
            className="text-text-dim hover:text-text-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="reject-reason"
              className="block text-sm font-medium text-text-secondary"
            >
              Reason for rejection
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Explain why this content should be rejected..."
              className="mt-1 block w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={regenerate}
              onChange={(e) => setRegenerate(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-surface-elevated text-primary focus:ring-primary"
            />
            <span className="flex items-center gap-1 text-sm text-text-secondary">
              <RotateCcw className="h-3.5 w-3.5" />
              Regenerate content with feedback
            </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending}
            className={cn(
              "rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/80",
              isPending && "cursor-not-allowed opacity-60"
            )}
          >
            {isPending ? "Rejecting..." : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

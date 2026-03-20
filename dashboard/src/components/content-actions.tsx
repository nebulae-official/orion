"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { approveContent, rejectContent } from "@/lib/actions";
import type { ContentStatus } from "@/types/api";
import { CheckCircle, XCircle, RotateCcw, Send } from "lucide-react";
import { PublishModal } from "@/components/publish-modal";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

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
          <Button
            onClick={handleApprove}
            disabled={isPending}
            className="bg-success text-white hover:bg-success/90"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        )}

        {canReject && (
          <Button
            variant="destructive"
            onClick={() => setShowRejectModal(true)}
            disabled={isPending}
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
        )}

        {optimisticStatus === "approved" && (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success-light">
            <CheckCircle className="h-4 w-4" />
            Approved
          </span>
        )}

        {canPublish && (
          <Button onClick={() => setShowPublishModal(true)}>
            <Send className="h-4 w-4" />
            Publish
          </Button>
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
    <Modal isOpen={true} onClose={onClose} title="Reject Content">
      <div className="mt-4 space-y-4">
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
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleSubmit}
          loading={isPending}
        >
          {isPending ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import {
  UserPlus,
  CircleUser,
  Mail,
  ArrowRight,
  X,
} from "lucide-react";
import type { User } from "@/types/api";
import { updateUserRole, toggleUserStatus, inviteUser } from "./actions";

interface AdminUser extends User {
  is_active: boolean;
  created_at: string;
}

export function UsersTable({
  users: initialUsers,
}: {
  users: AdminUser[];
}): React.ReactElement {
  const [users, setUsers] = useState(initialUsers);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "editor" | "viewer">(
    "viewer"
  );
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleRoleChange(
    userId: string,
    newRole: "admin" | "editor" | "viewer"
  ): Promise<void> {
    setActionLoading(userId);
    const result = await updateUserRole(userId, newRole);
    if (result.success) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    }
    setActionLoading(null);
  }

  async function handleToggleStatus(
    userId: string,
    currentActive: boolean
  ): Promise<void> {
    setActionLoading(userId);
    const result = await toggleUserStatus(userId, !currentActive);
    if (result.success) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_active: !currentActive } : u
        )
      );
    }
    setActionLoading(null);
  }

  async function handleInvite(): Promise<void> {
    setInviteMessage(null);
    setInviteLoading(true);
    const result = await inviteUser(inviteEmail, inviteRole);
    if (result.success) {
      setInviteMessage({ type: "success", text: "Invitation sent" });
      setInviteEmail("");
      setInviteRole("viewer");
    } else {
      setInviteMessage({
        type: "error",
        text: result.error ?? "Failed to send invitation",
      });
    }
    setInviteLoading(false);
  }

  return (
    <div className="space-y-4">
      {/* Invite Button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-muted"
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </button>
      </div>

      {/* Invite Form */}
      {showInvite && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text">
              Invite a new user
            </h3>
            <button
              onClick={() => {
                setShowInvite(false);
                setInviteMessage(null);
              }}
              className="text-text-muted hover:text-text transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {inviteMessage && (
            <div
              className={cn(
                "mb-4 rounded-lg border px-4 py-3 text-sm",
                inviteMessage.type === "success"
                  ? "border-success/20 bg-success-surface text-success"
                  : "border-danger/20 bg-danger-surface text-danger-light"
              )}
            >
              {inviteMessage.text}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="invite-email"
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-surface-elevated pl-10 pr-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="user@example.com"
                />
              </div>
            </div>
            <div className="w-full sm:w-36">
              <label
                htmlFor="invite-role"
                className="mb-1.5 block text-xs font-medium text-text-secondary"
              >
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(
                    e.target.value as "admin" | "editor" | "viewer"
                  )
                }
                className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviteLoading || !inviteEmail}
              className={cn(
                "flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-muted whitespace-nowrap",
                (inviteLoading || !inviteEmail) &&
                  "cursor-not-allowed opacity-60"
              )}
            >
              {inviteLoading ? (
                "Sending..."
              ) : (
                <>
                  Send Invite
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-lg shadow-black/10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Joined
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr
                key={user.id}
                className="transition-colors hover:bg-white/[0.02]"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.name}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <CircleUser className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">
                        {user.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onChange={(e) =>
                      handleRoleChange(
                        user.id,
                        e.target.value as "admin" | "editor" | "viewer"
                      )
                    }
                    disabled={actionLoading === user.id}
                    className="rounded-lg border border-border bg-surface-elevated px-2 py-1 text-xs text-text transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary capitalize"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                      user.is_active
                        ? "bg-success-surface text-success"
                        : "bg-danger-surface text-danger-light"
                    )}
                  >
                    {user.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-text-secondary">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() =>
                      handleToggleStatus(user.id, user.is_active)
                    }
                    disabled={actionLoading === user.id}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      user.is_active
                        ? "border-danger/20 text-danger-light hover:bg-danger-surface"
                        : "border-success/20 text-success hover:bg-success-surface",
                      actionLoading === user.id &&
                        "cursor-not-allowed opacity-60"
                    )}
                  >
                    {user.is_active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div className="py-12 text-center text-sm text-text-muted">
            No users found.
          </div>
        )}
      </div>
    </div>
  );
}

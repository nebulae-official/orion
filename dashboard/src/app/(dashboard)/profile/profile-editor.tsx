"use client";

import { useState, type FormEvent } from "react";
import {
  Save,
  Key,
  Link2,
  Github,
  Chrome,
  CircleUser,
  Shield,
  Calendar,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import type { User } from "@/types/api";
import { updateProfile, changePassword } from "./actions";

interface UserProfile extends User {
  bio?: string;
  timezone?: string;
  created_at?: string;
  oauth_providers?: string[];
}

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "UTC",
];

export function ProfileEditor({
  profile,
  readOnly = false,
}: {
  profile: UserProfile;
  readOnly?: boolean;
}): React.ReactElement {
  // Profile form state
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [timezone, setTimezone] = useState(profile.timezone ?? "UTC");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleProfileSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setProfileMessage(null);
    setProfileSaving(true);

    const result = await updateProfile({
      name,
      bio,
      timezone,
      avatar_url: avatarUrl || null,
    });

    setProfileMessage(
      result.success
        ? { type: "success", text: "Profile updated successfully" }
        : { type: "error", text: result.error ?? "Update failed" }
    );
    setProfileSaving(false);
  }

  async function handlePasswordSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 8 characters",
      });
      return;
    }

    setPasswordSaving(true);

    const result = await changePassword(currentPassword, newPassword);

    if (result.success) {
      setPasswordMessage({
        type: "success",
        text: "Password changed successfully",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } else {
      setPasswordMessage({
        type: "error",
        text: result.error ?? "Password change failed",
      });
    }
    setPasswordSaving(false);
  }

  const oauthProviders = profile.oauth_providers ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Profile Summary Card */}
      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg shadow-black/10">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <CircleUser className="h-10 w-10 text-primary" />
              )}
            </div>
            <h2 className="text-lg font-semibold text-text">{profile.name}</h2>
            <p className="text-sm text-text-secondary">{profile.email}</p>
            {profile.bio && (
              <p className="mt-2 text-sm text-text-muted">{profile.bio}</p>
            )}

            <div className="mt-4 w-full space-y-3 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-text-muted" />
                <span className="text-text-secondary">Role:</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
                  {profile.role}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-text-muted" />
                <span className="text-text-secondary">Timezone:</span>
                <span className="text-text">{timezone}</span>
              </div>
              {profile.created_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-text-muted" />
                  <span className="text-text-secondary">Joined:</span>
                  <span className="text-text">
                    {formatDate(profile.created_at)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Forms */}
      <div className={cn("space-y-6 lg:col-span-2", readOnly && "pointer-events-none opacity-60")}>
        {/* Edit Profile */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg shadow-black/10">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
            <CircleUser className="h-5 w-5 text-primary" />
            {readOnly ? "Profile Details" : "Edit Profile"}
          </h3>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {profileMessage && (
              <div
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm",
                  profileMessage.type === "success"
                    ? "border-success/20 bg-success-surface text-success"
                    : "border-danger/20 bg-danger-surface text-danger-light"
                )}
              >
                {profileMessage.text}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-name"
                  className="mb-1.5 block text-sm font-medium text-text-secondary"
                >
                  Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label
                  htmlFor="profile-avatar"
                  className="mb-1.5 block text-sm font-medium text-text-secondary"
                >
                  Avatar URL
                </label>
                <input
                  id="profile-avatar"
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="https://example.com/avatar.png"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-bio"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Bio
              </label>
              <textarea
                id="profile-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder="Tell us about yourself..."
              />
            </div>

            <div>
              <label
                htmlFor="profile-timezone"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Timezone
              </label>
              <select
                id="profile-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className={cn(
                  "flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-muted",
                  profileSaving && "cursor-not-allowed opacity-60"
                )}
              >
                <Save className="h-4 w-4" />
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg shadow-black/10">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
            <Key className="h-5 w-5 text-primary" />
            Change Password
          </h3>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {passwordMessage && (
              <div
                className={cn(
                  "rounded-lg border px-4 py-3 text-sm",
                  passwordMessage.type === "success"
                    ? "border-success/20 bg-success-surface text-success"
                    : "border-danger/20 bg-danger-surface text-danger-light"
                )}
              >
                {passwordMessage.text}
              </div>
            )}

            <div>
              <label
                htmlFor="current-password"
                className="mb-1.5 block text-sm font-medium text-text-secondary"
              >
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-1.5 block text-sm font-medium text-text-secondary"
                >
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="mb-1.5 block text-sm font-medium text-text-secondary"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  required
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-surface-elevated px-4 py-2.5 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordSaving}
                className={cn(
                  "flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-muted",
                  passwordSaving && "cursor-not-allowed opacity-60"
                )}
              >
                <Key className="h-4 w-4" />
                {passwordSaving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </div>

        {/* Connected Accounts */}
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-lg shadow-black/10">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
            <Link2 className="h-5 w-5 text-primary" />
            Connected Accounts
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <Github className="h-5 w-5 text-text" />
                <div>
                  <p className="text-sm font-medium text-text">GitHub</p>
                  <p className="text-xs text-text-secondary">
                    {oauthProviders.includes("github")
                      ? "Connected"
                      : "Not connected"}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  oauthProviders.includes("github")
                    ? "bg-success-surface text-success"
                    : "bg-surface text-text-muted"
                )}
              >
                {oauthProviders.includes("github") ? "Linked" : "Not linked"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <Chrome className="h-5 w-5 text-text" />
                <div>
                  <p className="text-sm font-medium text-text">Google</p>
                  <p className="text-xs text-text-secondary">
                    {oauthProviders.includes("google")
                      ? "Connected"
                      : "Not connected"}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  oauthProviders.includes("google")
                    ? "bg-success-surface text-success"
                    : "bg-surface text-text-muted"
                )}
              >
                {oauthProviders.includes("google") ? "Linked" : "Not linked"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

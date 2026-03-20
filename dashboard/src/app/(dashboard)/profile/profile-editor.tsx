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
  Camera,
  Youtube,
  Twitter,
  Instagram,
  ExternalLink,
  Unplug,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { GATEWAY_URL } from "@/lib/config";
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

  // Avatar editing state
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarInput, setAvatarInput] = useState(profile.avatar_url ?? "");

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Publishing account toast
  const [publishToast, setPublishToast] = useState<string | null>(null);

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

  function handleAvatarSave(): void {
    setAvatarUrl(avatarInput);
    setEditingAvatar(false);
  }

  function handlePublishConnect(platform: string): void {
    setPublishToast(`${platform} connection coming soon`);
    setTimeout(() => setPublishToast(null), 3000);
  }

  const oauthProviders = profile.oauth_providers ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Profile Summary Card */}
      <div className="lg:col-span-1 space-y-6">
        <div className="glass-card luminous-border rounded-2xl p-6">
          <div className="flex flex-col items-center text-center">
            {/* Large Avatar */}
            <div className="relative mb-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 shadow-lg shadow-primary/10 overflow-hidden">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    {getInitials(name)}
                  </span>
                )}
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setEditingAvatar(!editingAvatar)}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-primary text-white shadow-md transition-colors hover:bg-primary-muted"
                  title="Change avatar"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Avatar URL Input */}
            {editingAvatar && (
              <div className="mb-4 w-full space-y-2">
                <input
                  type="url"
                  value={avatarInput}
                  onChange={(e) => setAvatarInput(e.target.value)}
                  placeholder="Paste avatar URL..."
                  className="block w-full rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text placeholder-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAvatarSave}
                    className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-muted"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarInput(avatarUrl);
                      setEditingAvatar(false);
                    }}
                    className="flex-1 rounded-lg border border-border bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <h2 className="text-lg font-semibold text-text">{name}</h2>
            <p className="text-sm text-text-secondary">{profile.email}</p>
            {bio && (
              <p className="mt-2 text-sm text-text-muted">{bio}</p>
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

        {/* Connected Accounts (sidebar) */}
        <div className="glass-card luminous-border rounded-2xl p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
            <Link2 className="h-5 w-5 text-primary" />
            Connected Accounts
          </h3>

          <div className="space-y-3">
            {/* GitHub */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <Github className="h-5 w-5 text-text" />
                <div>
                  <p className="text-sm font-medium text-text">GitHub</p>
                  <p className="text-xs text-text-secondary">
                    {oauthProviders.includes("github")
                      ? "Connected as @admin"
                      : "Not connected"}
                  </p>
                </div>
              </div>
              {oauthProviders.includes("github") ? (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-surface px-3 py-1.5 text-xs font-medium text-danger-light transition-colors hover:bg-danger/20"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              ) : (
                <a
                  href={`${GATEWAY_URL}/api/v1/auth/oauth/github?redirect=/profile`}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect
                </a>
              )}
            </div>

            {/* Google */}
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
              {oauthProviders.includes("google") ? (
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-surface px-3 py-1.5 text-xs font-medium text-danger-light transition-colors hover:bg-danger/20"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  Disconnect
                </button>
              ) : (
                <a
                  href={`${GATEWAY_URL}/api/v1/auth/oauth/google?redirect=/profile`}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Connect
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Forms */}
      <div className={cn("space-y-6 lg:col-span-2", readOnly && "pointer-events-none opacity-60")}>
        {/* Edit Profile */}
        <div className="glass-card luminous-border rounded-2xl p-6">
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
        <div className="glass-card luminous-border rounded-2xl p-6">
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

        {/* Publishing Accounts */}
        <div className="glass-card luminous-border rounded-2xl p-6">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
            <Video className="h-5 w-5 text-primary" />
            Publishing Accounts
          </h3>
          <p className="mb-4 text-sm text-text-muted">
            Connect your social media accounts to publish content directly from Orion.
          </p>

          {publishToast && (
            <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              {publishToast}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {/* YouTube */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
                  <Youtube className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">YouTube</p>
                  <p className="text-xs text-text-secondary">Not connected</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handlePublishConnect("YouTube")}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
              >
                Connect
              </button>
            </div>

            {/* TikTok */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10">
                  <svg className="h-5 w-5 text-cyan-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.21 8.21 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.14z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-text">TikTok</p>
                  <p className="text-xs text-text-secondary">Not connected</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handlePublishConnect("TikTok")}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
              >
                Connect
              </button>
            </div>

            {/* Twitter/X */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                  <Twitter className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">Twitter / X</p>
                  <p className="text-xs text-text-secondary">Not connected</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handlePublishConnect("Twitter/X")}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
              >
                Connect
              </button>
            </div>

            {/* Instagram */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10">
                  <Instagram className="h-5 w-5 text-pink-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text">Instagram</p>
                  <p className="text-xs text-text-secondary">Not connected</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handlePublishConnect("Instagram")}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

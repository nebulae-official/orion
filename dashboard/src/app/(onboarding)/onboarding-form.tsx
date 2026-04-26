"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { completeOnboarding, checkUsername } from "@/lib/onboarding-actions";

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

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function OnboardingForm({
  name,
  email,
  avatarUrl,
}: {
  name: string;
  email: string;
  avatarUrl?: string;
}): React.ReactElement {
  const router = useRouter();

  // Derive first/last from OAuth display name
  const nameParts = name.split(" ");
  const defaultFirstName = nameParts[0] ?? "";
  const defaultLastName = nameParts.slice(1).join(" ");

  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect browser timezone on mount
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz) setTimezone(tz);
    } catch {
      // Keep UTC default
    }
  }, []);

  const checkAvailability = useCallback(async (value: string) => {
    if (!USERNAME_REGEX.test(value)) {
      setUsernameAvailable(null);
      setUsernameChecking(false);
      return;
    }
    setUsernameChecking(true);
    const result = await checkUsername(value);
    setUsernameAvailable(result.available);
    setUsernameChecking(false);
  }, []);

  function handleUsernameChange(value: string): void {
    const normalized = value.toLowerCase().replace(/[^a-z0-9_]/g, "");
    setUsername(normalized);
    setUsernameAvailable(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (USERNAME_REGEX.test(normalized)) {
      setUsernameChecking(true);
      debounceRef.current = setTimeout(() => {
        void checkAvailability(normalized);
      }, 300);
    }
  }

  const usernameValid = USERNAME_REGEX.test(username);
  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const canSubmit =
    usernameValid &&
    usernameAvailable === true &&
    passwordValid &&
    passwordsMatch &&
    !submitting;

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await completeOnboarding({
      username,
      password,
      confirm_password: confirmPassword,
      first_name: firstName || undefined,
      last_name: lastName || undefined,
      timezone,
    });

    if (result.success) {
      router.replace("/");
      router.refresh();
    } else {
      setError(result.error ?? "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        {/* Avatar */}
        <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/30 bg-primary/10 shadow-lg shadow-primary/10 overflow-hidden">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className="text-xl font-bold text-primary">
              {getInitials(name || "U")}
            </span>
          )}
        </div>
        {name && (
          <p className="text-sm font-medium text-foreground">{name}</p>
        )}
        <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
          Complete Your Setup
        </CardTitle>
        <CardDescription>
          Step 1 of 1 &mdash; Set up your account to get started with Orion
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Read-only fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="onboard-name">Display Name</Label>
              <Input
                id="onboard-name"
                type="text"
                value={name}
                disabled
                className="disabled:opacity-70"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboard-email">Email</Label>
              <Input
                id="onboard-email"
                type="email"
                value={email}
                disabled
                className="disabled:opacity-70"
              />
            </div>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="onboard-username">Username</Label>
              <div className="relative">
                <Input
                  id="onboard-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="e.g. johndoe"
                  className="pr-9"
                  aria-describedby="username-hint"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  {usernameChecking && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!usernameChecking && usernameAvailable === true && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  {!usernameChecking && usernameAvailable === false && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </div>
              </div>
              <p id="username-hint" className="text-xs text-muted-foreground">
                {username.length > 0 && !usernameValid
                  ? "3-30 characters, lowercase letters, numbers, and underscores only"
                  : usernameAvailable === false
                    ? "This username is already taken"
                    : "Choose a unique username"}
              </p>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="onboard-password">Password</Label>
              <Input
                id="onboard-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
              {password.length > 0 && !passwordValid && (
                <p className="text-xs text-destructive">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="onboard-confirm-password">Confirm Password</Label>
              <Input
                id="onboard-confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>

            {/* First / Last Name */}
            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="onboard-first-name">
                  First Name <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="onboard-first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onboard-last-name">
                  Last Name <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="onboard-last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label htmlFor="onboard-timezone">Timezone</Label>
              <select
                id="onboard-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="block h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {TIMEZONES.includes(timezone) ? null : (
                  <option value={timezone}>{timezone}</option>
                )}
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Button
            type="submit"
            className={cn("w-full", !canSubmit && "opacity-60")}
            disabled={!canSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Completing setup...
              </>
            ) : (
              <>
                Complete Setup
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

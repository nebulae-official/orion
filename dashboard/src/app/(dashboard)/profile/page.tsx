import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserCircle } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { getSession } from "@/lib/auth";
import { DEMO_MODE } from "@/lib/config";
import { demoUser } from "@/lib/demo-data";
import type { User } from "@/types/api";
import { ProfileEditor } from "./profile-editor";

interface UserProfile extends User {
  bio?: string;
  timezone?: string;
  created_at?: string;
  oauth_providers?: string[];
}

export default async function ProfilePage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  let profile: UserProfile | null = null;
  let fetchError = false;
  let usingCachedProfile = false;

  if (DEMO_MODE) {
    profile = {
      ...demoUser,
      bio: "Orion system administrator",
      timezone: "America/New_York",
      created_at: new Date(Date.now() - 90 * 86_400_000).toISOString(),
      oauth_providers: ["github"],
    };
  } else {
    try {
      profile = await serverFetch<UserProfile>(
        "/api/v1/identity/users/me",
        {},
        token
      );
    } catch {
      fetchError = true;

      // Fall back to user data from cookie
      const session = await getSession();
      if (session.user) {
        profile = {
          ...session.user,
        };
        usingCachedProfile = true;
      }
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <UserCircle className="h-8 w-8 text-cyan" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              Profile
            </h1>
            <p className="mt-1 text-text-secondary">
              Manage your account settings and preferences.
            </p>
          </div>
        </div>
      </div>

      {fetchError && !usingCachedProfile && (
        <div className="mb-6 rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load profile data. Please try again later.
        </div>
      )}

      {usingCachedProfile && (
        <div className="mb-6 rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Showing cached profile. Some features may be unavailable.
        </div>
      )}

      {profile && <ProfileEditor profile={profile} readOnly={usingCachedProfile} />}
    </div>
  );
}

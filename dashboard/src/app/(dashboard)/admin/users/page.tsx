import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { serverFetch } from "@/lib/api-client";
import { DEMO_MODE } from "@/lib/config";
import { demoAdminUsers } from "@/lib/demo-data";
import type { User } from "@/types/api";
import { UsersTable } from "./users-table";

interface AdminUser extends User {
  is_active: boolean;
  created_at: string;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
}

export default async function AdminUsersPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;
  const userStr = cookieStore.get("orion_user")?.value;

  if (!token && !DEMO_MODE) {
    redirect("/login");
  }

  // Check admin role
  if (!DEMO_MODE && userStr) {
    try {
      const user = JSON.parse(userStr) as User;
      if (user.role !== "admin") {
        redirect("/");
      }
    } catch {
      redirect("/");
    }
  }

  let users: AdminUser[] = [];
  let total = 0;
  let fetchError = false;

  if (DEMO_MODE) {
    users = demoAdminUsers;
    total = demoAdminUsers.length;
  } else {
    try {
      const response = await serverFetch<UsersResponse>(
        "/api/v1/identity/users",
        {},
        token
      );
      users = response.users;
      total = response.total;
    } catch {
      fetchError = true;
    }
  }

  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-cyan" />
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-text">
              User Management
            </h1>
            <p className="mt-1 text-text-secondary">
              Manage users, roles, and access to the platform.
            </p>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="mb-6 rounded-xl border border-warning-surface bg-warning-surface/30 p-4 text-sm text-warning-light">
          Unable to load user data. Please try again later.
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="glass-card luminous-border rounded-xl p-4">
          <p className="text-sm text-text-secondary">Total Users</p>
          <p className="text-2xl font-bold text-text">{total}</p>
        </div>
        <div className="glass-card luminous-border rounded-xl p-4">
          <p className="text-sm text-text-secondary">Active</p>
          <p className="text-2xl font-bold text-success">{activeCount}</p>
        </div>
        <div className="glass-card luminous-border rounded-xl p-4">
          <p className="text-sm text-text-secondary">Disabled</p>
          <p className="text-2xl font-bold text-text-muted">
            {total - activeCount}
          </p>
        </div>
      </div>

      <UsersTable users={users} />
    </div>
  );
}

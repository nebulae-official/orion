import { cookies } from "next/headers";
import type { User } from "@/types/api";
import OnboardingForm from "../onboarding-form";

export default async function OnboardingPage(): Promise<React.ReactElement> {
  const cookieStore = await cookies();
  const userStr = cookieStore.get("orion_user")?.value ?? null;
  const user: User | null = userStr ? (JSON.parse(userStr) as User) : null;

  return (
    <OnboardingForm
      name={user?.name ?? ""}
      email={user?.email ?? ""}
      avatarUrl={user?.avatar_url ?? undefined}
    />
  );
}

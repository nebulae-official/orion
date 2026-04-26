import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { decodeToken } from "@/lib/jwt";
import { DEMO_MODE } from "@/lib/config";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  // Demo users don't need onboarding
  if (DEMO_MODE) {
    redirect("/");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("orion_token")?.value;

  if (!token) {
    redirect("/");
  }

  const claims = decodeToken(token);
  if (claims?.onboarding !== true) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/4 top-1/4 h-96 w-96 rounded-full bg-primary opacity-[0.04] blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-primary opacity-[0.04] blur-[120px]" />
      </div>

      <div className="relative w-full max-w-lg px-4 py-8">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            Orion
          </span>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          Orion Digital Twin Content Agency
        </p>
      </div>
    </div>
  );
}

import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import RegisterForm from "./register-form";

export default function RegisterPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 animate-pulse text-white" />
          </div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}

import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
            <div className="text-center">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Orion
              </h1>
              <p className="mt-2 text-sm text-gray-500">Loading...</p>
            </div>
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

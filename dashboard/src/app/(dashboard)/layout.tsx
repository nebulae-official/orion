import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ToastProvider>
      <div className="flex h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-surface focus:text-primary"
        >
          Skip to content
        </a>
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto bg-bg">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

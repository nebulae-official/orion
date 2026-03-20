import { Sidebar } from "@/components/sidebar";
import { TopNav } from "@/components/top-nav";
import { ToastProvider } from "@/components/toast";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <ToastProvider>
      <div className="min-h-screen">
        {/* Nebula mesh gradient background — provides colored orbs for glass blur */}
        <div className="nebula-bg" aria-hidden="true" />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-surface focus:text-primary"
        >
          Skip to content
        </a>
        <Sidebar />
        <TopNav />
        <main id="main-content" className="relative z-10 ml-0 md:ml-20 lg:ml-72 pt-16 min-h-screen">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

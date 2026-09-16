"use client";

import { useEffect } from "react";
import "./globals.css";
import { Inter } from "next/font/google";
import { Chatbot } from "@/components/Chatbot";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminTopbar } from "@/components/AdminTopbar";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";

function AdminMainContent({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <main className={`relative z-10 pt-16 min-h-screen transition-all duration-300 ${collapsed ? "md:ml-[72px]" : "md:ml-[260px]"}`}>
      <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
        {children}
      </div>
    </main>
  );
}

function ClientLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div className="client-shell relative w-full min-h-screen bg-zinc-950">
      <ClientSidebar />
      <CallNotificationBar />
      <main className={`min-h-screen transition-all duration-300 pt-6 px-4 md:px-6 ${collapsed ? "ml-[72px]" : "ml-[220px]"}`}>
        {children}
      </main>
      <Chatbot />
    </div>
  );
}
import { ClientSidebar } from "@/components/ClientSidebar";
import { usePathname } from 'next/navigation';
import { RoleProvider, useRole } from "@/context/RoleContext";
import { CallNotificationBar } from "@/components/CallNotificationBar";

const inter = Inter({ subsets: ["latin"] });

function AppContent({ children }: { children: React.ReactNode }) {
  const { role, loading } = useRole();
  const pathname = usePathname();
  const isClient = role === "Client";
  const isAdminOrEmployee = role === "Admin" || role === "Employee" || role === "Intern";

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.group("Global Error Captured");
      console.error("Message:", event.message);
      if (event.error?.stack) console.error("Stack:", event.error.stack);
      console.groupEnd();
    };
    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center admin-shell">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-lg animate-pulse">
            SH
          </div>
          <p className="text-slate-400 text-sm font-semibold animate-pulse">Loading...</p>
        </div>
      </div>
    );
  }

  if (pathname === '/login') {
    return <main className="h-screen w-full">{children}</main>;
  }

  // ── Client layout ──
  if (isClient) {
    return (
      <SidebarProvider>
        <ClientLayout>{children}</ClientLayout>
      </SidebarProvider>
    );
  }

  // ── Admin / Employee / Intern — Premium Light Layout ──
  if (isAdminOrEmployee) {
    return (
      <SidebarProvider>
      <div className="admin-shell min-h-screen">
        {/* Sidebar */}
        <AdminSidebar />

        {/* Topbar */}
        <AdminTopbar />

        {/* Main Content */}
        <AdminMainContent>{children}</AdminMainContent>

        <Chatbot />
      </div>
      </SidebarProvider>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="p-6">{children}</main>
    </div>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <RoleProvider>
          <AppContent>{children}</AppContent>
        </RoleProvider>
      </body>
    </html>
  );
}

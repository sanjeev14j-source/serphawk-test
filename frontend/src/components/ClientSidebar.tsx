"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Grid3x3,
  FileText,
  Menu,
  Settings,
  LogOut,
  Target,
  Upload,
  Bell,
  CheckSquare,
  Receipt,
  FileSignature,
  BarChart2,
  ChevronRight,
} from "lucide-react";
import { useRole } from "@/context/RoleContext";
import { useSidebar } from "@/context/SidebarContext";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { icon: Grid3x3, href: "/", label: "Dashboard" },
  { icon: FileText, href: "/store", label: "Services" },
  { icon: CheckSquare, href: "/tasks", label: "Tasks" },
  { icon: Receipt, href: "/invoices", label: "Invoices" },
  { icon: FileSignature, href: "/proposals", label: "Proposals" },
  { icon: BarChart2, href: "/rankings", label: "Rankings" },
  { icon: Menu, href: "/messages", label: "Messages" },
  { icon: Target, href: "/milestones", label: "Milestones" },
  { icon: Upload, href: "/my-files", label: "My Files" },
  { icon: Bell, href: "/notifications", label: "Notifications" },
  { icon: Settings, href: "/setup", label: "Settings" },
];

export function ClientSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useRole();
  const { collapsed, setCollapsed } = useSidebar();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const initial = user?.name?.charAt(0).toUpperCase() || "S";

  return (
    <>
      <motion.div
        initial={false}
        animate={{ width: collapsed ? 72 : 220 }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col py-6 overflow-hidden bg-zinc-950"
      >
        {/* Company Logo */}
        <div className={cn("flex items-center gap-3 mb-8 shrink-0", collapsed ? "justify-center px-0" : "px-5")}>
          <Link
            href="/"
            className="w-11 h-11 bg-amber-600 rounded-lg flex items-center justify-center text-white font-black text-lg hover:bg-amber-500 transition-colors shadow-lg shrink-0"
            style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
          >
            {initial}
          </Link>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col overflow-hidden"
              >
                <span className="font-black text-white text-base leading-tight tracking-tight">SERP Hawk</span>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Client Portal</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav Icons */}
        <nav className={cn("flex flex-col gap-1 flex-1 overflow-y-auto", collapsed ? "items-center px-0" : "px-3")}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative rounded-lg flex items-center transition-all group shrink-0",
                  collapsed ? "w-11 h-11 justify-center" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-amber-600/20 text-amber-500"
                    : "text-stone-500 hover:text-stone-300 hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-amber-600/15 border border-amber-600/30 rounded-lg"
                  />
                )}
                <item.icon className="w-5 h-5 relative z-10 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.15 }}
                      className={cn(
                        "text-[13px] font-semibold relative z-10 truncate",
                        isActive ? "text-amber-400 font-bold" : "text-stone-400 group-hover:text-stone-200"
                      )}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {/* Tooltip only when collapsed */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-3 py-1.5 bg-zinc-800 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-white/10">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User + Logout at bottom */}
        <div className={cn("shrink-0 border-t border-white/5 pt-3", collapsed ? "px-0 flex flex-col items-center" : "px-3")}>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 mb-2"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-stone-300 truncate">{user?.name || "Client"}</p>
                  <p className="text-[10px] font-semibold text-amber-500">Client</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <button
            onClick={handleLogout}
            className={cn(
              "rounded-lg flex items-center transition-all group",
              collapsed ? "w-11 h-11 justify-center" : "gap-3 px-3 py-2.5 w-full",
              "text-stone-600 hover:text-red-400 hover:bg-white/5"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[13px] font-semibold"
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
            {collapsed && (
              <span className="absolute left-full ml-3 px-3 py-1.5 bg-zinc-800 text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl border border-white/10">
                Logout
              </span>
            )}
          </button>
        </div>
      </motion.div>

      {/* Expand / Collapse toggle button */}
      <motion.button
        onClick={() => setCollapsed(!collapsed)}
        animate={{ left: collapsed ? 72 : 220 }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        whileHover={{ x: 3 }}
        whileTap={{ scale: 0.92 }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-14 rounded-r-xl bg-amber-600 shadow-lg shadow-amber-900/40 text-white hover:bg-amber-500 transition-colors"
      >
        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-300", !collapsed && "rotate-180")} />
      </motion.button>
    </>
  );
}

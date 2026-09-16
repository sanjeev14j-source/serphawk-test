"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Bot,
  Phone,
  MessageCircle,
  GraduationCap,
  UserCog,
  Briefcase,
  LayoutGrid,
  Inbox,
  Activity,
  Settings,
  LogOut,
  ChevronRight,
  Sparkles,
  Zap,
  CheckSquare,
  FileText,
  FileSignature,
  BarChart2,
  Bell,
  Trophy,
} from "lucide-react";
import { useRole, Role } from "@/context/RoleContext";
import { useSidebar } from "@/context/SidebarContext";
import { cn } from "@/lib/utils";

interface NavItem {
  name: string;
  icon: any;
  href: string;
  roles: Role[];
  badge?: string;
  badgeColor?: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  // Core
  { name: "Dashboard", icon: LayoutDashboard, href: "/", roles: ["Admin", "Employee", "Intern"], section: "Core" },
  { name: "Clients", icon: Users, href: "/clients", roles: ["Admin", "Employee"], section: "Core" },
  { name: "Projects", icon: FolderKanban, href: "/projects", roles: ["Admin", "Employee", "Intern"], section: "Core" },
  { name: "Tasks", icon: CheckSquare, href: "/tasks", roles: ["Admin", "Employee", "Intern"], section: "Core", badge: "New", badgeColor: "emerald" },
  // Growth
  { name: "Email Agent", icon: Bot, href: "/email-agent", roles: ["Admin", "Employee"], section: "Growth", badge: "AI", badgeColor: "violet" },
  { name: "Calls", icon: Phone, href: "/calls", roles: ["Admin", "Employee"], section: "Growth" },
  { name: "Messages", icon: MessageCircle, href: "/messages", roles: ["Admin", "Employee"], section: "Growth" },
  { name: "Notifications", icon: Bell, href: "/notifications", roles: ["Admin", "Employee", "Intern", "Client"], section: "Growth" },
  // Revenue
  { name: "Invoices", icon: FileText, href: "/invoices", roles: ["Admin", "Employee"], section: "Revenue", badge: "New", badgeColor: "emerald" },
  { name: "Proposals", icon: FileSignature, href: "/proposals", roles: ["Admin", "Employee"], section: "Revenue", badge: "New", badgeColor: "emerald" },
  // Organization
  { name: "Services Overview", icon: LayoutGrid, href: "/admin/services-overview", roles: ["Admin", "Employee"], section: "Org" },
  { name: "Request Board", icon: Inbox, href: "/admin/requests", roles: ["Admin", "Employee"], section: "Org" },
  { name: "Interns", icon: GraduationCap, href: "/interns", roles: ["Admin", "Employee"], section: "Org" },
  { name: "Employees", icon: UserCog, href: "/employees", roles: ["Admin"], section: "Org" },
  { name: "Services", icon: Briefcase, href: "/admin/services", roles: ["Admin"], section: "Org" },
  // Tools
  { name: "Rankings", icon: BarChart2, href: "/rankings", roles: ["Admin", "Employee"], section: "Tools", badge: "New", badgeColor: "emerald" },
  { name: "Audit", icon: Activity, href: "/audit", roles: ["Employee"], section: "Tools" },
  { name: "Pricing", icon: Zap, href: "/pricing", roles: ["Employee"], section: "Tools" },
];

const SECTIONS = [
  { key: "Core", label: "Core" },
  { key: "Growth", label: "Growth Engine" },
  { key: "Revenue", label: "Revenue" },
  { key: "Org", label: "Organization" },
  { key: "Tools", label: "Tools" },
];

const BADGE_COLORS: Record<string, string> = {
  violet: "bg-violet-100 text-violet-700 border border-violet-200",
  emerald: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  sky: "bg-sky-100 text-sky-700 border border-sky-200",
};

export function AdminSidebar() {
  const pathname = usePathname();
  const { role, logout, email } = useRole();
  const { collapsed, setCollapsed } = useSidebar();

  const filteredBySection = (sectionKey: string) =>
    NAV_ITEMS.filter(
      (item) => item.section === sectionKey && item.roles.includes(role as Role)
    );

  return (
    <>
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 35 }}
      className="admin-sidebar fixed left-0 top-0 h-screen z-40 flex flex-col overflow-hidden"
    >
      {/* ── Logo ── */}
      <div className="relative flex items-center gap-3 px-4 py-5 border-b border-slate-100 shrink-0">
        <div className="btn-glow-indigo w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0">
          SH
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col overflow-hidden"
            >
              <span className="font-black text-slate-800 text-base leading-tight tracking-tight">SERP Hawk</span>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> CRM Platform
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>



      {/* ── Nav ── */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {SECTIONS.map((section) => {
          const items = filteredBySection(section.key);
          if (!items.length) return null;
          return (
            <div key={section.key}>
              <AnimatePresence>
                {!collapsed && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-3 mb-2"
                  >
                    {section.label}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                  return (
                    <Link key={item.href} href={item.href}>
                      <motion.div
                        whileHover={{ x: collapsed ? 0 : 3 }}
                        whileTap={{ scale: 0.97 }}
                        className={cn(
                          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all group",
                          collapsed ? "justify-center" : "",
                          isActive ? "nav-item-active" : "hover:bg-slate-50"
                        )}
                        title={collapsed ? item.name : undefined}
                      >
                        {/* Active left border accent */}
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-400 rounded-r-full" />
                        )}

                        <item.icon
                          className={cn(
                            "w-[18px] h-[18px] shrink-0 transition-colors",
                            isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                          )}
                        />

                        <AnimatePresence>
                          {!collapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -6 }}
                              className="flex items-center gap-2 flex-1 min-w-0"
                            >
                              <span
                                className={cn(
                                  "text-[13px] font-semibold truncate transition-colors",
                                  isActive ? "text-slate-800 font-bold" : "text-slate-500 group-hover:text-slate-800"
                                )}
                              >
                                {item.name}
                              </span>
                              {item.badge && (
                                <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0", BADGE_COLORS[item.badgeColor || "violet"])}>
                                  {item.badge}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Tooltip for collapsed */}
                        {collapsed && (
                          <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900/95 border border-white/10 text-white text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity shadow-xl backdrop-blur-lg z-50">
                            {item.name}
                            <div className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2 h-2 bg-slate-900/95 border-l border-b border-white/10 rotate-45" />
                          </div>
                        )}
                      </motion.div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── User / Logout ── */}
      <div className="border-t border-slate-100 p-3 shrink-0 space-y-1">
        {/* User card */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-1"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-indigo-900/40">
                {email ? email[0].toUpperCase() : "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-slate-700 truncate">{email || "User"}</p>
                <p className="text-[10px] font-semibold text-indigo-500">{role}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logout */}
        <button
          onClick={logout}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all group",
            collapsed && "justify-center"
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="w-[17px] h-[17px] shrink-0 transition-colors" />
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
        </button>
      </div>
    </motion.aside>

    {/* ── Expand / collapse tab — outside aside so it's never clipped ── */}
    <motion.button
      onClick={() => setCollapsed(!collapsed)}
      animate={{ left: collapsed ? 72 : 260 }}
      transition={{ type: "spring", stiffness: 300, damping: 35 }}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.92 }}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="fixed top-1/2 -translate-y-1/2 z-50 flex items-center justify-center w-5 h-14 rounded-r-xl bg-indigo-600 shadow-lg shadow-indigo-300/60 text-white hover:bg-indigo-700 transition-colors"
    >
      <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-300", !collapsed && "rotate-180")} />
    </motion.button>
    </>
  );
}

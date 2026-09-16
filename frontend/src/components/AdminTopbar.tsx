"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Bell,
  Settings,
  ChevronDown,
  LogOut,
  User,
  X,
  Sparkles,
  Clock,
  Command,
} from "lucide-react";
import { useRole, Role } from "@/context/RoleContext";
import { useSidebar } from "@/context/SidebarContext";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/config";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/clients": "Clients",
  "/projects": "Projects",
  "/tasks": "Task Board",
  "/invoices": "Invoices",
  "/proposals": "Proposals",
  "/rankings": "Keyword Rankings",
  "/notifications": "Notifications",
  "/email-agent": "Email Agent",
  "/calls": "Call Center",
  "/messages": "Messages",
  "/interns": "Intern Pool",
  "/employees": "Employees",
  "/admin/services-overview": "Services Overview",
  "/admin/requests": "Request Board",
  "/admin/services": "Services",
  "/audit": "Audit Center",
  "/pricing": "Pricing",
  "/store": "Growth Services",
  "/setup": "Initial Setup",
  "/monitor": "Live Monitor",
  "/documents": "Documents",
};

const ROLE_BADGE: Record<Role, { label: string; color: string }> = {
  Admin: { label: "Admin", color: "bg-indigo-100 text-indigo-700 border border-indigo-200" },
  Employee: { label: "Employee", color: "bg-sky-100 text-sky-700 border border-sky-200" },
  Client: { label: "Client", color: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  Intern: { label: "Intern", color: "bg-amber-100 text-amber-700 border border-amber-200" },
};

export function AdminTopbar() {
  const { role, email, logout, user } = useRole();
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const pageTitle = PAGE_TITLES[pathname] || pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Dashboard";
  const badge = ROLE_BADGE[role as Role];

  // Fetch unread notification count
  useEffect(() => {
    if (!user?.id) return;
    const fetchNotifs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/${user.id}?unread_only=true`);
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
        setRecentNotifs((data.notifications || []).slice(0, 3));
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [user?.id]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus();
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [searchOpen]);

  // Live search debounce
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <header className={`admin-topbar fixed top-0 right-0 left-0 ${collapsed ? 'md:left-[72px]' : 'md:left-[260px]'} h-16 z-30 flex items-center px-6 gap-4 transition-all duration-300`}>
      {/* Subtle top border gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-300/40 to-transparent" />

      {/* ── Page Title ── */}
      <div className="flex-1 flex items-center gap-3">
        <div>
          <h1 className="text-[15px] font-black text-slate-800 leading-tight capitalize">{pageTitle}</h1>
          <p className="text-[10px] text-slate-400 font-medium hidden md:block">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="hidden md:flex">
        <motion.button
          onClick={() => setSearchOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all text-[13px] min-w-[200px]"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search...</span>
          <div className="ml-auto flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 rounded-md px-1.5 py-0.5">
            <Command className="w-3 h-3" />K
          </div>
        </motion.button>
      </div>

      {/* ── Right Controls ── */}
      <div className="flex items-center gap-2" ref={userRef}>
        {/* Mobile search */}
        <button
          onClick={() => setSearchOpen(true)}
          className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
        >
          <Search className="w-4.5 h-4.5" />
        </button>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
            className="relative p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-80 glass-card overflow-hidden z-50"
              >
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-[13px] font-black text-slate-700">Notifications</p>
                  <p className="text-[10px] text-slate-400">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}</p>
                </div>
                {recentNotifs.length > 0 ? recentNotifs.map((n: any) => (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer">
                    <span className="text-lg mt-0.5">
                      {n.type === "success" ? "✅" : n.type === "warning" ? "⚠️" : n.type === "error" ? "❌" : "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-slate-700">{n.title}</p>
                      <p className="text-[11px] text-slate-400 truncate">{n.message}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-400">
                      <Clock className="w-2.5 h-2.5" />
                      {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-[12px] text-slate-400">No new notifications</div>
                )}
                <div className="px-4 py-2.5 border-t border-slate-100">
                  <Link href="/notifications" onClick={() => setNotifOpen(false)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 w-full text-center block transition-colors">
                    View all notifications
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 mx-1" />

        {/* User Menu */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-200"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-[13px] shadow-md">
              {email ? email[0].toUpperCase() : "U"}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-[12px] font-bold text-slate-700 leading-tight max-w-[120px] truncate">{email || "User"}</p>
              <p className="text-[10px] text-indigo-500 font-semibold">{role}</p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${userMenuOpen ? "rotate-180" : ""}`} />
          </motion.button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 glass-card overflow-hidden z-50"
              >
                {/* Profile header */}
                  <div className="px-3 py-3 border-b border-slate-100 flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm">
                    {email ? email[0].toUpperCase() : "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-slate-700 truncate">{email || "User"}</p>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${badge?.color}`}>
                      {badge?.label}
                    </span>
                  </div>
                </div>
                {/* Menu items */}
                <div className="py-1.5">
                  <button className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all">
                    <User className="w-3.5 h-3.5" /> Profile
                  </button>
                  <button className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all">
                    <Settings className="w-3.5 h-3.5" /> Settings
                  </button>
                </div>
                <div className="border-t border-slate-100 py-1.5">
                  <button
                    onClick={() => { logout(); router.push("/login"); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-[12px] font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Full-screen Search Modal ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false); }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setSearchOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              className="relative w-full max-w-xl glass-card shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-100">
                <Search className="w-4 h-4 text-indigo-400 shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clients, projects, tasks, invoices..."
                  className="flex-1 bg-transparent text-[14px] text-slate-700 placeholder:text-slate-400 outline-none font-medium"
                />
                {searching && <div className="w-4 h-4 border-2 border-indigo-300 border-t-transparent rounded-full animate-spin shrink-0" />}
                <button
                  onClick={() => setSearchOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3 max-h-80 overflow-y-auto">
                {searchQuery.trim() && searchResults.length > 0 ? (
                  <>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Results</p>
                    {searchResults.map((r: any, i: number) => {
                      const icons: Record<string, string> = { client: '👤', project: '📁', task: '✅', invoice: '💰' };
                      return (
                        <button key={`${r.type}-${r.id}-${i}`}
                          onClick={() => { router.push(r.link); setSearchOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-all text-left">
                          <span className="text-sm">{icons[r.type] || '🔍'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-bold text-slate-700 truncate">{r.title}</p>
                            {r.sub && <p className="text-[10px] text-slate-400 truncate">{r.sub}</p>}
                          </div>
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 shrink-0">{r.type}</span>
                        </button>
                      );
                    })}
                  </>
                ) : searchQuery.trim() && !searching ? (
                  <p className="text-[12px] text-slate-400 text-center py-6">No results for &ldquo;{searchQuery}&rdquo;</p>
                ) : (
                  <>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-2">Quick Navigation</p>
                    {["/", "/clients", "/projects", "/email-agent", "/calls", "/admin/services-overview"].map((href) => (
                      <button key={href}
                        onClick={() => { router.push(href); setSearchOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-all group">
                        <span className="text-[12px] font-semibold text-slate-500 group-hover:text-slate-700 transition-colors capitalize">
                          {PAGE_TITLES[href] || href}
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Press ESC to close</span>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Sparkles className="w-2.5 h-2.5" /> Powered by CRM
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

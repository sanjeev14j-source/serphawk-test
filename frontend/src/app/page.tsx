"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users, Send, Clock, Briefcase, Target, Zap, Activity,
  Globe, CheckCircle, FolderKanban, Mail, ArrowUpRight,
  Bot, UserCheck, GraduationCap, Phone, Sparkles, FileText, ChevronRight, MessageCircle,
  Shield, Lock, FileCheck, Bell, DollarSign, TrendingUp, Eye, Download, AlertTriangle, CheckCircle2, Circle, Timer
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { fetchWithCache } from "@/lib/cache";
import { useRole } from "@/context/RoleContext";
import { cn } from "@/lib/utils";
import PageGuide from '@/components/PageGuide';
import Link from "next/link";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120 } },
};

interface RecentActivity {
  id: number; action: string; method: string; content: string; createdAt: string | null;
}
interface AdminStats {
  total: number; active: number; pending: number; hold: number;
  totalProjects: number; totalEmailsSent: number; totalActivities: number;
  totalCalls: number; totalEmployees: number; totalInterns: number;
  chartLabels: string[]; activityChart: number[]; emailChart: number[]; callChart: number[];
  recentActivities: RecentActivity[];
}
interface ClientStats {
  isClient: true; companyName: string; projectName: string; website: string;
  status: string; seoStrategy: string; recommended_services: string;
  targetKeywords: string[]; nextMilestone: string; nextMilestoneDate: string;
  active_services_list: any[];
  pending_quotes_list: any[];
  pending_requests_count: number;
  milestones: any[];
  invoices: any[];
  invoice_summary: { total_billed: number; total_paid: number; total_pending: number; total_overdue: number };
  files: any[];
  activities: any[];
  notifications: any[];
  unread_notifications_count: number;
  proposals: any[];
  projects: any[];
}
type StatsData = AdminStats | ClientStats | null;

const NAV_CARDS = [
  { href: "/clients", icon: Users, gradient: "from-indigo-500 to-indigo-600", title: "Clients Hub", description: "The Foundation: Manage every client profile, track growth protocols, milestones, and maintain professional relationships in one central hub.", roles: ["Admin", "Employee"] },
  { href: "/email-agent", icon: Bot, gradient: "from-violet-500 to-purple-600", title: "Email Agent", description: "Growth Engine: AI-powered outreach that auto-analyzes leads and drafts personalized bilingual emails to scale your revenue automatically.", roles: ["Admin", "Employee"] },
  { href: "/calls", icon: Phone, gradient: "from-amber-500 to-orange-600", title: "Call Center", description: "Touchpoint Intelligence: Log every conversation, track follow-ups, and ensure no lead is ever left without a clear next step or work assignment.", roles: ["Admin", "Employee"] },
  { href: "/projects", icon: FolderKanban, gradient: "from-sky-400 to-cyan-500", title: "Project Board", description: "Execution Layer: Oversee complex workflows, assign specialized team members, and ensure every milestone is delivered with precision and quality.", roles: ["Admin", "Employee", "Intern"] },
  { href: "/interns", icon: GraduationCap, gradient: "from-rose-400 to-rose-500", title: "Talent Pool", description: "Scale Support: Manage your interns, assign learning tasks, and monitor their contribution to the core team's productivity and growth.", roles: ["Admin", "Employee"] },
  { href: "/admin/services-overview", icon: Briefcase, gradient: "from-fuchsia-500 to-pink-600", title: "Services Overview", description: "Master Board: Organization-wide view of all active service lines, client consumers, and assigned execution teams.", roles: ["Admin", "Employee"] },
  { href: "/setup", icon: Globe, gradient: "from-indigo-500 to-indigo-600", title: "Initial Setup", description: "Connect your website and social media profiles for automated cross-channel analysis.", roles: ["Client"] },
  { href: "/audit", icon: Activity, gradient: "from-emerald-500 to-teal-500", title: "One-Click Audit", description: "Run deep technical SEO scans and compare your performance against top competitors.", roles: ["Client", "Admin", "Employee"] },
  { href: "/messages", icon: Send, gradient: "from-violet-500 to-purple-600", title: "Team Comm Hub", description: "Direct communication with your assigned SEO specialists, shared files, and priority queues.", roles: ["Client", "Admin", "Employee"] },
  { href: "/monitor", icon: Target, gradient: "from-amber-500 to-orange-600", title: "Live Monitor", description: "Real-time ranking tracker and performance analytics synced with GA4 and GSC.", roles: ["Client"] },
  { href: "/store", icon: Briefcase, gradient: "from-indigo-500 to-violet-600", title: "Growth Services", description: "Explore our exclusive catalog of growth services. Request anything and receive a personalized quote from your dedicated team.", roles: ["Client"] },
];

// Inline mini bar chart (no external library needed)
function MiniBarChart({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-1.5 h-16 w-full">
      {data.map((val, i) => (
        <div key={i} className="flex flex-col items-center flex-1 gap-1 h-full justify-end group">
          <div className="relative w-full flex items-end justify-center h-full">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(val / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
              className={cn("w-full rounded-t-lg min-h-[3px] opacity-80", color)}
              title={`${labels[i]}: ${val}`}
            />
          </div>
          <span className="text-[9px] font-bold">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, sub, icon: Icon, gradient, href }: {
  title: string; value: number | string; sub: string; icon: any; gradient: string; href?: string;
}) {
  const inner = (
    <motion.div variants={itemVariants} className="relative group overflow-hidden glass-card glass-card-hover cursor-pointer">
      <div className={cn("absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br", gradient)} />
      {/* Top accent line */}
      <div className={cn("absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-60 transition-opacity bg-gradient-to-r", gradient)} />
      <div className="relative p-5 flex flex-col z-10">
        <div className="flex justify-between items-start mb-3">
          <div className={cn("p-2.5 rounded-xl bg-gradient-to-br shadow-lg", gradient)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          {href && <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />}
        </div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{title}</p>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{value}</h3>
        <div className="mt-2 inline-flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
          <p className="text-[10px] font-bold text-slate-400">{sub}</p>
        </div>
      </div>
    </motion.div>
  );
  return href ? <Link href={href} className="cursor-pointer">{inner}</Link> : inner;
}

export default function Dashboard() {
  const { role, email, user } = useRole();
  const [stats, setStats] = useState<StatsData>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = role === "Admin" || role === "Employee";

  useEffect(() => {
    if (!role) return;
    const url = `${API_BASE_URL}/dashboard-stats?role=${role}&email=${email}`;
    fetchWithCache<StatsData>(
      url,
      (data: StatsData, _isFromCache: boolean) => {
        setStats(data);
        setLoading(false);
      },
      60_000
    ).catch(() => setLoading(false));
  }, [role, email]);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border border-indigo-500/20" />
          <div className="absolute inset-0 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <div className="absolute inset-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full animate-pulse" />
        </div>
        <p className="text-slate-400 text-sm font-semibold animate-pulse">Loading Dashboard...</p>
      </div>
    );
  }

  // Fallback if role is not set
  if (!role) {
    return (
      <motion.div initial="hidden" animate="show" variants={containerVariants}>
        <motion.div variants={itemVariants} className="glass-card p-10 text-center">
          <span className="text-[10px] tracking-widest font-black text-amber-600 uppercase">Warning</span>
          <h1 className="text-3xl font-black text-slate-800 mt-1 mb-3">Session Error</h1>
          <p className="text-slate-400 font-medium">Unable to load your profile. Please refresh or log in again.</p>
        </motion.div>
      </motion.div>
    );
  }

  const adminStats = isAdmin ? (stats as AdminStats) : null;
  const clientStats = !isAdmin ? (stats as ClientStats) : null;
  const visibleNavCards = NAV_CARDS.filter(c => c.roles.includes(role));

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className={cn(isAdmin ? "space-y-6" : "")}>
      {/* ═══ ADMIN WELCOME HEADER ═══ */}
      {isAdmin && (
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl">
          {/* Glass card */}
          <div className="glass-card relative p-8 md:p-10 overflow-hidden">
            {/* Glow blobs */}
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-100 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 left-1/3 w-48 h-48 bg-violet-100 rounded-full blur-3xl pointer-events-none" />
            {/* Top border */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent" />

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.25em]">Live Operations</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-slate-800 leading-tight tracking-tight">
                  Operations{" "}
                  <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent animate-gradient">
                    Center
                  </span>
                </h1>
                <p className="text-slate-500 font-medium text-base">
                  Welcome back, <span className="text-indigo-600 font-bold">{user?.name || role}</span>. Your metrics are synced.
                </p>
              </div>
              <div className="flex gap-3 shrink-0 w-full md:w-auto">
                <Link href="/clients" className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-800 hover:border-slate-300 transition-all">
                  View Clients
                </Link>
                <Link href="/email-agent" className="btn-glow-indigo px-5 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Launch Agent
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── ADMIN VIEW ─────────────────────────────────────────────────── */}
      {isAdmin && adminStats && (
        <>
          <PageGuide
            pageKey="dashboard-admin"
            title="Welcome to Operations Center"
            description="This is your command hub — everything you need to run the business is accessible from here."
            steps={[
              { icon: '📊', text: 'The stat cards at the top show live metrics: clients, projects, emails, calls, and revenue.' },
              { icon: '📇', text: 'Navigation cards below let you jump to any section: Client Hub, Email Agent, Call Center, etc.' },
              { icon: '⚙️', text: 'Use the sidebar to navigate between pages, or click the quick-access cards here.' },
              { icon: '🔔', text: 'Check Notifications (bell icon) for real-time alerts about client activity and proposals.' },
            ]}
          />

          {/* Row 1: 4+4 stat pills in dark glass */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatCard title="Clients" value={adminStats.total} sub="Total" icon={Users} gradient="from-indigo-500 to-indigo-600" href="/clients" />
            <StatCard title="Active" value={adminStats.active} sub="Live" icon={Zap} gradient="from-emerald-400 to-emerald-500" href="/clients" />
            <StatCard title="Projects" value={adminStats.totalProjects} sub="Ongoing" icon={FolderKanban} gradient="from-sky-400 to-cyan-500" href="/projects" />
            <StatCard title="Emails" value={adminStats.totalEmailsSent} sub="Sent" icon={Send} gradient="from-violet-500 to-purple-600" href="/email-agent" />
            <StatCard title="Activities" value={adminStats.totalActivities} sub="Logs" icon={Activity} gradient="from-blue-500 to-indigo-600" href="/email-agent" />
            <StatCard title="Calls" value={adminStats.totalCalls} sub="Logged" icon={Phone} gradient="from-amber-400 to-orange-500" href="/calls" />
            <StatCard title="Employees" value={adminStats.totalEmployees} sub="Staff" icon={UserCheck} gradient="from-teal-500 to-emerald-500" href="/employees" />
            <StatCard title="Interns" value={adminStats.totalInterns} sub="Pool" icon={GraduationCap} gradient="from-rose-400 to-rose-500" href="/interns" />
          </div>

          {/* Row 2: Three metric charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Activity chart */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Activity Logs</p>
                  <p className="text-3xl font-black text-slate-800 mt-0.5">{adminStats.totalActivities}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <MiniBarChart
                data={adminStats.activityChart ?? [0,0,0,0,0,0,0]}
                labels={adminStats.chartLabels ?? ["","","","","","",""]}
                color="bg-indigo-500"
              />
            </motion.div>

            {/* Email chart */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-violet-100 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Emails Outbound</p>
                  <p className="text-3xl font-black text-slate-800 mt-0.5">{adminStats.totalEmailsSent}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-200 text-violet-600">
                  <Mail className="w-5 h-5" />
                </div>
              </div>
              <MiniBarChart
                data={adminStats.emailChart ?? [0,0,0,0,0,0,0]}
                labels={adminStats.chartLabels ?? ["","","","","","",""]}
                color="bg-violet-500"
              />
            </motion.div>

            {/* Call chart */}
            <motion.div variants={itemVariants} className="glass-card glass-card-hover p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Call Interactions</p>
                  <p className="text-3xl font-black text-slate-800 mt-0.5">{adminStats.totalCalls}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
                  <Phone className="w-5 h-5" />
                </div>
              </div>
              <MiniBarChart
                data={adminStats.callChart ?? [0,0,0,0,0,0,0]}
                labels={adminStats.chartLabels ?? ["","","","","","",""]}
                color="bg-amber-500"
              />
            </motion.div>
          </div>

          {/* Row 3: Pipeline overview (dark glass wide card) */}
          <motion.div variants={itemVariants} className="glass-card p-6 md:p-8 relative overflow-hidden">
            <div className="absolute -bottom-10 left-1/2 w-64 h-32 bg-indigo-50 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-3 mb-6 relative z-10">
              <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="font-black text-[15px] text-slate-700">Operational Pipeline</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 relative z-10">
              {[
                { label: "Pending Setup", value: adminStats.pending, accent: "border-amber-200 bg-amber-50 text-amber-700" },
                { label: "On Hold", value: adminStats.hold, accent: "border-rose-200 bg-rose-50 text-rose-700" },
                { label: "Total Activities", value: adminStats.totalActivities, accent: "border-indigo-200 bg-indigo-50 text-indigo-700" },
                { label: "Calls Logged", value: adminStats.totalCalls, accent: "border-orange-200 bg-orange-50 text-orange-700" },
                { label: "Emails Deployed", value: adminStats.totalEmailsSent, accent: "border-violet-200 bg-violet-50 text-violet-700" },
              ].map(({ label, value, accent }) => (
                <div key={label} className={`rounded-2xl border p-5 ${accent}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">{label}</p>
                  <span className="font-black text-3xl">{value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Row 4: Quick Access navigation cards */}
          <motion.div variants={itemVariants}>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Quick Access</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleNavCards.map((card) => (
                <Link key={card.href} href={card.href}>
                  <motion.div
                    variants={itemVariants}
                    whileHover={{ y: -4, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="group relative overflow-hidden glass-card cursor-pointer p-6 transition-all hover:border-indigo-200"
                    style={{ borderRadius: "1.25rem" }}
                  >
                    {/* Gradient glow on hover */}
                    <div className={cn("absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 bg-gradient-to-br", card.gradient)} />
                    {/* Top border accent */}
                    <div className={cn("absolute top-0 left-6 right-6 h-px opacity-0 group-hover:opacity-60 transition-opacity bg-gradient-to-r from-transparent to-transparent", card.gradient.replace("from-", "via-"))} />
                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-5">
                        <div className={cn("p-3 rounded-2xl bg-gradient-to-br shadow-lg", card.gradient)}>
                          <card.icon className="w-5 h-5 text-white" />
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                      </div>
                      <h3 className="font-black text-[15px] text-slate-600 mb-1.5 group-hover:text-slate-900 transition-colors">{card.title}</h3>
                      <p className="text-[12px] text-slate-400 font-medium leading-relaxed group-hover:text-slate-500 transition-colors">{card.description}</p>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Row 5: Recent Activity */}
          <motion.div variants={itemVariants} className="glass-card p-6 md:p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="font-black text-[15px] text-slate-700">Recent Activity</h3>
              </div>
              <Link href="/email-agent" className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors">
                View All
              </Link>
            </div>
            {(adminStats.recentActivities?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-3">
                <Activity className="w-10 h-10 opacity-30 text-slate-400" />
                <p className="font-bold text-sm text-slate-400">No activities yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 relative z-10">
                {adminStats.recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 transition-all group">
                    <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 shrink-0 group-hover:bg-indigo-100 transition-colors">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-700 text-[13px] truncate">{act.action}</p>
                      <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{act.content}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">{act.createdAt ? new Date(act.createdAt).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}

      {/* ── CLIENT VIEW — EDITORIAL CHAPTERS ────────────────────────── */}
      {!isAdmin && (
        <div className="client-editorial">

          <div className="mb-6 px-4">
            <PageGuide
              pageKey="dashboard-client"
              variant="dark"
              title="Welcome to Your Growth Dashboard"
              description="This is your personal hub — track your SEO campaign, manage services, and communicate with your team."
              steps={[
                { icon: '🏠', text: 'Scroll down to see your quick-access cards: Setup, Audit, Messages, Monitor, Store, and more.' },
                { icon: '🛒', text: 'Visit the Store to browse services, request quotes, and track your active orders.' },
                { icon: '💬', text: 'Use Messages to communicate with your dedicated team about ongoing services.' },
                { icon: '📈', text: 'Check Monitor for live analytics, Rankings for keyword positions, and Audit for site health.' },
              ]}
            />
          </div>

          {/* ═══ CHAPTER 01: HERO — Full-viewport dark cinematic ═══ */}
          <section className="relative min-h-screen flex items-center justify-center bg-zinc-950 overflow-hidden">
            {/* Faux architectural light beam */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950" />
              <div className="absolute top-[10%] left-[30%] w-[500px] h-[700px] bg-gradient-to-br from-amber-700/25 via-amber-600/10 to-transparent rotate-[-25deg] blur-[2px]" />
              <div className="absolute top-[5%] left-[35%] w-[200px] h-[800px] bg-gradient-to-b from-amber-500/15 via-amber-400/5 to-transparent rotate-[-20deg] blur-[1px]" />
              <div className="absolute top-0 right-[20%] w-[300px] h-[500px] bg-gradient-to-bl from-stone-600/10 via-transparent to-transparent" />
              {/* Subtle concrete texture overlay */}
              <div className="absolute inset-0 opacity-[0.04]" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'}} />
            </div>

            <div className="relative z-10 flex flex-col items-center text-center px-8">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-amber-500/80 text-[11px] md:text-xs font-bold tracking-[0.35em] uppercase mb-8"
              >
                Welcome Back
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, type: "spring", stiffness: 60, damping: 20 }}
                className="text-7xl md:text-[8rem] lg:text-[10rem] font-black text-white tracking-[-0.02em] leading-[0.85]"
                style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
              >
                {clientStats?.companyName || user?.name || 'Your Company'}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-stone-500 text-[11px] md:text-xs tracking-[0.3em] uppercase mt-10 font-medium"
              >
                Your Growth Story Continues
              </motion.p>
              {/* Security Trust Bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="flex items-center gap-6 mt-14"
              >
                <div className="flex items-center gap-2 text-emerald-500/60">
                  <Shield className="w-4 h-4" />
                  <span className="text-[9px] font-bold tracking-[0.25em] uppercase">Protected</span>
                </div>
                <div className="w-px h-4 bg-stone-800" />
                <div className="flex items-center gap-2 text-emerald-500/60">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold tracking-[0.25em] uppercase">256-bit SSL</span>
                </div>
                <div className="w-px h-4 bg-stone-800" />
                <div className="flex items-center gap-2 text-emerald-500/60">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-bold tracking-[0.25em] uppercase">Private Portal</span>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="absolute bottom-12 flex flex-col items-center gap-2 text-stone-600 text-[10px] tracking-[0.3em] uppercase"
              >
                <span>Scroll</span>
                <motion.span animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} className="text-stone-500">↓</motion.span>
              </motion.div>
            </div>
          </section>

          {/* ═══ ONBOARDING CHECKLIST ═══ */}
          {clientStats && (() => {
            const checks = [
              { key: 'profile', label: 'Complete Company Profile', done: !!(clientStats.companyName && clientStats.website), link: '/clients' },
              { key: 'setup', label: 'Verify Your Domain', done: false, link: '/setup' },
              { key: 'files', label: 'Upload Your First Document', done: (clientStats.files?.length || 0) > 0, link: '/my-files' },
              { key: 'services', label: 'Explore & Request Services', done: (clientStats.active_services_list?.length || 0) > 0 || clientStats.pending_requests_count > 0, link: '/store' },
              { key: 'proposals', label: 'Review Your Proposals', done: (clientStats.proposals?.length || 0) > 0, link: '/proposals' },
            ];
            const completed = checks.filter(c => c.done).length;
            const progress = Math.round((completed / checks.length) * 100);
            if (progress >= 100) return null; // hide when all done
            return (
              <section className="bg-zinc-900 border-t border-white/5">
                <div className="max-w-3xl mx-auto px-8 md:px-16 py-16">
                  <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-amber-600 text-[11px] font-bold tracking-[0.3em] uppercase mb-2">Getting Started</p>
                        <h3 className="text-2xl font-black text-white" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>Onboarding Checklist</h3>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-amber-500">{progress}%</p>
                        <p className="text-[10px] text-stone-500 font-bold tracking-widest uppercase">{completed}/{checks.length} done</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-1.5 bg-white/5 rounded-full mb-8 overflow-hidden">
                      <motion.div initial={{ width: 0 }} whileInView={{ width: `${progress}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.3 }}
                        className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full" />
                    </div>
                    <div className="space-y-3">
                      {checks.map((item, i) => (
                        <Link key={item.key} href={item.link}>
                          <motion.div initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                            className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer group ${item.done ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/[0.02] border-white/5 hover:border-amber-600/30 hover:bg-amber-600/5'}`}>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.done ? 'border-emerald-500 bg-emerald-500/20' : 'border-stone-600 group-hover:border-amber-600'}`}>
                              {item.done && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <span className={`font-medium text-sm ${item.done ? 'text-stone-500 line-through' : 'text-stone-300 group-hover:text-amber-400'}`}>{item.label}</span>
                            {!item.done && <ChevronRight className="w-4 h-4 text-stone-600 ml-auto group-hover:text-amber-500 transition-colors" />}
                          </motion.div>
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </section>
            );
          })()}

          {/* ═══ CHAPTER 02: YOUR IDENTITY — Dark section ═══ */}
          {clientStats && (
            <section className="bg-zinc-950 text-white">
              <div className="max-w-7xl mx-auto px-8 md:px-16 py-24 md:py-32">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
                  {/* Left: Identity Info */}
                  <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                  >
                    <p className="text-amber-600 text-[11px] font-bold tracking-[0.3em] uppercase mb-4">Chapter 02</p>
                    <h2
                      className="text-5xl md:text-7xl font-black text-white mb-16 leading-[0.95]"
                      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                    >
                      Your Identity
                    </h2>

                    {/* Company Card */}
                    <div className="flex items-center gap-5 mb-16">
                      <div className="w-16 h-16 bg-amber-600 rounded-xl flex items-center justify-center text-white font-black text-2xl shrink-0" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                        {clientStats.companyName?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <h3 className="font-black text-2xl text-white" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{clientStats.companyName}</h3>
                        <p className="text-stone-500 text-[10px] font-bold tracking-[0.25em] uppercase mt-1">Active Client Since 2024</p>
                      </div>
                    </div>

                    {/* Info Fields */}
                    <div className="space-y-10">
                      {[
                        { label: 'Company', value: clientStats.companyName, icon: Briefcase },
                        { label: 'Website', value: clientStats.website || '—', icon: Globe },
                        { label: 'Status', value: clientStats.status || 'Active', icon: CheckCircle },
                        { label: 'Project', value: clientStats.projectName || '—', icon: FolderKanban },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="flex items-start gap-4">
                          <Icon className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-1">{label}</p>
                            <p className="text-stone-300 text-lg font-medium">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Right: Abstract visual block */}
                  <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="relative aspect-[4/5] rounded-2xl overflow-hidden hidden lg:block"
                  >
                    {/* Faux architectural image using gradients */}
                    <div className="absolute inset-0 bg-gradient-to-br from-stone-800 via-stone-700 to-stone-900" />
                    <div className="absolute top-[15%] left-[20%] w-[300px] h-[400px] bg-gradient-to-br from-amber-600/40 via-amber-500/15 to-transparent rotate-[-20deg] blur-[1px]" />
                    <div className="absolute top-[10%] left-[30%] w-[120px] h-[500px] bg-gradient-to-b from-amber-400/20 via-amber-300/5 to-transparent rotate-[-15deg]" />
                    <div className="absolute bottom-0 right-0 w-[60%] h-[40%] bg-gradient-to-tl from-stone-900/80 to-transparent" />
                    {/* Concrete texture */}
                    <div className="absolute inset-0 opacity-[0.06]" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'1.2\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")'}} />
                  </motion.div>
                </div>

                {/* Strategy & Keywords Row — still in dark */}
                {(clientStats.seoStrategy || clientStats.targetKeywords?.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="mt-24 pt-16 border-t border-white/5"
                  >
                    {clientStats.seoStrategy && (
                      <div className="mb-12">
                        <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-3">Active Strategy</p>
                        <p className="text-stone-300 text-xl md:text-2xl font-medium leading-relaxed italic max-w-3xl" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>&ldquo;{clientStats.seoStrategy}&rdquo;</p>
                      </div>
                    )}
                    {clientStats.targetKeywords?.length > 0 && (
                      <div>
                        <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-4">Target Keywords</p>
                        <div className="flex flex-wrap gap-3">
                          {clientStats.targetKeywords.map((kw: string) => (
                            <span key={kw} className="px-5 py-2.5 border border-white/10 text-stone-400 font-medium text-sm rounded-lg hover:border-amber-600/30 hover:text-amber-400 transition-colors">{kw}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {clientStats.nextMilestone && (
                      <div className="mt-12 p-8 border border-amber-600/20 rounded-xl bg-amber-600/5 max-w-2xl">
                        <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-2">Next Milestone</p>
                        <p className="text-white font-black text-xl" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{clientStats.nextMilestone}</p>
                        {clientStats.nextMilestoneDate && <p className="text-stone-500 text-sm mt-1">{clientStats.nextMilestoneDate}</p>}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </section>
          )}

          {/* ═══ CHAPTER 03: IN MOTION — Light section ═══ */}
          {clientStats && (clientStats.active_services_list?.length > 0 || clientStats.pending_requests_count > 0) && (
            <section className="bg-stone-100">
              <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 md:py-32">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <p className="text-amber-700 text-[11px] font-bold tracking-[0.3em] uppercase mb-4">Chapter 03</p>
                  <h2
                    className="text-5xl md:text-7xl font-black text-zinc-900 mb-16 leading-[0.95]"
                    style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                  >
                    In Motion
                  </h2>
                </motion.div>

                {/* Numbered Service List */}
                <div className="space-y-0">
                  {clientStats.active_services_list?.map((svc: any, index: number) => (
                    <motion.div
                      key={svc.id}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: index * 0.08 }}
                      className="flex items-center justify-between py-10 border-b border-stone-300/60 group"
                    >
                      <div className="flex items-center gap-8">
                        <span className="text-6xl md:text-7xl font-black text-stone-300/60 leading-none select-none" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h3 className="text-xl md:text-2xl font-black text-zinc-900" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{svc.service_name}</h3>
                          <p className="text-amber-700 text-[10px] font-bold tracking-[0.25em] uppercase mt-1">{svc.status}</p>
                        </div>
                      </div>
                      <Link href="/messages" className="p-3 bg-stone-200/80 rounded-lg text-stone-500 hover:bg-amber-600 hover:text-white transition-all">
                        <MessageCircle className="w-5 h-5" />
                      </Link>
                    </motion.div>
                  ))}

                  {/* Pending Requests */}
                  {clientStats.pending_requests_count > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="flex items-center justify-between py-10 border-b border-stone-300/60"
                    >
                      <div className="flex items-center gap-8">
                        <span className="text-6xl md:text-7xl font-black text-stone-300/60 leading-none select-none" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                          {String((clientStats.active_services_list?.length || 0) + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h3 className="text-xl md:text-2xl font-black text-zinc-900" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                            {clientStats.pending_requests_count} Request{clientStats.pending_requests_count > 1 ? 's' : ''} in Review
                          </h3>
                          <p className="text-amber-700 text-[10px] font-bold tracking-[0.25em] uppercase mt-1">Pending</p>
                        </div>
                      </div>
                      <div className="p-3 bg-stone-200/80 rounded-lg text-stone-400">
                        <Clock className="w-5 h-5" />
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ═══ CHAPTER 04: PENDING QUOTES — Amber accent section ═══ */}
          {clientStats?.pending_quotes_list?.length > 0 && (
            <section className="bg-zinc-950 text-white">
              <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 md:py-32">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <p className="text-amber-600 text-[11px] font-bold tracking-[0.3em] uppercase mb-4">Chapter 04</p>
                  <h2
                    className="text-5xl md:text-7xl font-black text-white mb-16 leading-[0.95]"
                    style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                  >
                    Action Required
                  </h2>
                </motion.div>

                <div className="space-y-6">
                  {clientStats.pending_quotes_list.map((quote: any, index: number) => (
                    <motion.div
                      key={quote.id}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="p-8 border border-amber-600/20 rounded-xl bg-amber-600/5 flex flex-col md:flex-row md:items-center justify-between gap-6"
                    >
                      <div>
                        <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-1">New Quote</p>
                        <h3 className="text-2xl font-black text-white" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{quote.service_name}</h3>
                        {quote.quote_message && <p className="text-stone-500 text-sm mt-2">{quote.quote_message}</p>}
                      </div>
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase">Amount</p>
                          <p className="text-3xl font-black text-white">${quote.quoted_amount?.toLocaleString()}</p>
                        </div>
                        <Link href="/store" className="px-6 py-3 bg-amber-600 text-white font-black rounded-xl text-sm hover:bg-amber-500 transition-colors">
                          Review & Accept
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ═══ CHAPTER: MILESTONES TIMELINE — Dark section ═══ */}
          {clientStats && clientStats.milestones?.length > 0 && (
            <section className="bg-zinc-950 text-white relative overflow-hidden">
              {/* Security badge */}
              <div className="absolute top-6 right-8 flex items-center gap-2 text-emerald-500/60 z-10">
                <Shield className="w-4 h-4" />
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase">Verified Data</span>
              </div>
              <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 md:py-32">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <p className="text-amber-600 text-[11px] font-bold tracking-[0.3em] uppercase mb-4">Milestones</p>
                  <h2 className="text-5xl md:text-7xl font-black text-white mb-16 leading-[0.95]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                    Your Roadmap
                  </h2>
                </motion.div>

                {/* Progress overview */}
                <div className="mb-12 p-6 border border-white/5 rounded-xl bg-white/[0.02]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-stone-400 text-sm font-bold">Overall Progress</span>
                    <span className="text-amber-500 font-black text-lg">
                      {clientStats.milestones.filter((m: any) => m.status === 'Achieved').length}/{clientStats.milestones.length}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${(clientStats.milestones.filter((m: any) => m.status === 'Achieved').length / clientStats.milestones.length) * 100}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                    />
                  </div>
                </div>

                {/* Timeline */}
                <div className="relative">
                  <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/10" />
                  <div className="space-y-8">
                    {clientStats.milestones.map((m: any, index: number) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.08 }}
                        className="flex gap-6 items-start"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                          m.status === 'Achieved' ? 'bg-emerald-500/20 border border-emerald-500/40' :
                          m.status === 'InProgress' ? 'bg-amber-500/20 border border-amber-500/40' :
                          'bg-white/5 border border-white/10'
                        }`}>
                          {m.status === 'Achieved' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                           m.status === 'InProgress' ? <Timer className="w-5 h-5 text-amber-400" /> :
                           <Circle className="w-5 h-5 text-stone-600" />}
                        </div>
                        <div className={`flex-1 p-6 rounded-xl border ${
                          m.status === 'Achieved' ? 'border-emerald-500/20 bg-emerald-500/[0.03]' :
                          m.status === 'InProgress' ? 'border-amber-500/20 bg-amber-500/[0.03]' :
                          'border-white/5 bg-white/[0.02]'
                        }`}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-black text-lg text-white" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{m.title}</h3>
                              {m.description && <p className="text-stone-500 text-sm mt-1">{m.description}</p>}
                            </div>
                            <span className={`text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full shrink-0 ${
                              m.status === 'Achieved' ? 'bg-emerald-500/20 text-emerald-400' :
                              m.status === 'InProgress' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-white/5 text-stone-500'
                            }`}>{m.status}</span>
                          </div>
                          {m.due_date && (
                            <p className="text-stone-600 text-xs mt-3 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" /> Due: {m.due_date}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ═══ CHAPTER: PROJECTS — Light section ═══ */}
          {clientStats && clientStats.projects?.length > 0 && (
            <section className="bg-stone-100">
              <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 md:py-32">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-amber-700 text-[11px] font-bold tracking-[0.3em] uppercase">Projects</p>
                    <div className="flex items-center gap-2 text-emerald-600/60">
                      <Lock className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-bold tracking-[0.2em] uppercase">Encrypted</span>
                    </div>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-black text-zinc-900 mb-16 leading-[0.95]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                    Active Work
                  </h2>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clientStats.projects.map((proj: any, index: number) => (
                    <motion.div
                      key={proj.id}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.08 }}
                      className="p-8 bg-white rounded-xl border border-stone-200/60 hover:border-amber-600/30 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-500">
                          <FolderKanban className="w-5 h-5 text-white" />
                        </div>
                        <span className={`text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1 rounded-full ${
                          proj.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          proj.status === 'Completed' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          proj.status === 'Hold' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-stone-50 text-stone-600 border border-stone-200'
                        }`}>{proj.status}</span>
                      </div>
                      <h3 className="font-black text-zinc-900 text-xl mb-2" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{proj.name}</h3>
                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-stone-400 text-[10px] font-bold tracking-widest uppercase">Progress</span>
                          <span className="text-stone-600 text-sm font-black">{proj.progress || 0}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${proj.progress || 0}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ═══ CHAPTER: BILLING & INVOICES — Dark section ═══ */}
          {clientStats && (clientStats.invoices?.length > 0 || clientStats.proposals?.length > 0) && (
            <section className="bg-zinc-950 text-white relative overflow-hidden">
              {/* Security badge */}
              <div className="absolute top-6 right-8 flex items-center gap-2 text-emerald-500/60 z-10">
                <Lock className="w-4 h-4" />
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase">Secure • SSL Encrypted</span>
              </div>
              <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 md:py-32">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <p className="text-amber-600 text-[11px] font-bold tracking-[0.3em] uppercase mb-4">Billing</p>
                  <h2 className="text-5xl md:text-7xl font-black text-white mb-16 leading-[0.95]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                    Financial Overview
                  </h2>
                </motion.div>

                {/* Summary Cards */}
                {clientStats.invoice_summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
                    {[
                      { label: 'Total Billed', value: clientStats.invoice_summary.total_billed, icon: DollarSign, color: 'text-white', bg: 'border-white/10 bg-white/[0.03]' },
                      { label: 'Paid', value: clientStats.invoice_summary.total_paid, icon: CheckCircle, color: 'text-emerald-400', bg: 'border-emerald-500/20 bg-emerald-500/[0.05]' },
                      { label: 'Pending', value: clientStats.invoice_summary.total_pending, icon: Clock, color: 'text-amber-400', bg: 'border-amber-500/20 bg-amber-500/[0.05]' },
                      { label: 'Overdue', value: clientStats.invoice_summary.total_overdue, icon: AlertTriangle, color: 'text-rose-400', bg: 'border-rose-500/20 bg-rose-500/[0.05]' },
                    ].map(({ label, value, icon: Icon, color, bg }) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className={`p-6 rounded-xl border ${bg}`}
                      >
                        <Icon className={`w-5 h-5 ${color} mb-3`} />
                        <p className="text-stone-500 text-[10px] font-bold tracking-[0.25em] uppercase mb-1">{label}</p>
                        <p className={`text-2xl font-black ${color}`}>${value?.toLocaleString() || '0'}</p>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Invoice List */}
                {clientStats.invoices?.length > 0 && (
                  <div className="space-y-0">
                    <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-6">Invoice History</p>
                    {clientStats.invoices.map((inv: any, index: number) => (
                      <motion.div
                        key={inv.id}
                        initial={{ opacity: 0, y: 10 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.06 }}
                        className="flex items-center justify-between py-6 border-b border-white/5 group hover:bg-white/[0.02] px-4 -mx-4 rounded-lg transition-colors"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-stone-500" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm">{inv.invoice_number}</p>
                            <p className="text-stone-600 text-xs mt-0.5">{new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className={`text-[10px] font-bold tracking-[0.15em] uppercase px-3 py-1 rounded-full ${
                            inv.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' :
                            inv.status === 'Overdue' ? 'bg-rose-500/20 text-rose-400' :
                            inv.status === 'Sent' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-white/5 text-stone-400'
                          }`}>{inv.status}</span>
                          <p className="text-white font-black text-lg w-28 text-right">${inv.total?.toLocaleString()}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Proposals */}
                {clientStats.proposals?.length > 0 && (
                  <div className="mt-16">
                    <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-6">Proposals</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {clientStats.proposals.map((prop: any, index: number) => (
                        <motion.div
                          key={prop.id}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: index * 0.06 }}
                          className="p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:border-amber-600/20 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <h4 className="font-bold text-white text-sm">{prop.title}</h4>
                            <span className={`text-[9px] font-bold tracking-[0.15em] uppercase px-2.5 py-0.5 rounded-full ${
                              prop.status === 'Accepted' ? 'bg-emerald-500/20 text-emerald-400' :
                              prop.status === 'Sent' ? 'bg-blue-500/20 text-blue-400' :
                              prop.status === 'Rejected' ? 'bg-rose-500/20 text-rose-400' :
                              'bg-white/5 text-stone-500'
                            }`}>{prop.status}</span>
                          </div>
                          {prop.total_value && <p className="text-amber-400 font-black text-xl mt-3">${prop.total_value.toLocaleString()}</p>}
                          {prop.valid_until && <p className="text-stone-600 text-xs mt-2">Valid until {prop.valid_until}</p>}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ═══ CHAPTER: SHARED FILES — Dark section ═══ */}
          {clientStats && clientStats.files?.length > 0 && (
            <section className="bg-zinc-950">
              <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 md:py-32">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-amber-500 text-[11px] font-bold tracking-[0.3em] uppercase">Documents</p>
                    <div className="flex items-center gap-2 text-emerald-500/70">
                      <Shield className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-bold tracking-[0.2em] uppercase">Protected Files</span>
                    </div>
                  </div>
                  <h2 className="text-5xl md:text-7xl font-black text-white mb-16 leading-[0.95]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                    Shared Files
                  </h2>
                </motion.div>

                <div className="space-y-3">
                  {clientStats.files.map((file: any, index: number) => (
                    <motion.div
                      key={file.id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center justify-between p-5 bg-zinc-900 rounded-xl border border-white/5 hover:border-amber-600/30 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-700/30 flex items-center justify-center">
                          <FileCheck className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-sm">{file.filename}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {file.description && <p className="text-stone-400 text-xs">{file.description}</p>}
                            <span className="text-stone-500 text-xs">{new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            {file.file_size && <span className="text-stone-500 text-xs">{(file.file_size / 1024).toFixed(1)} KB</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-emerald-500/70">
                          <Lock className="w-3 h-3" />
                          <span className="text-[8px] font-bold tracking-[0.2em] uppercase">Secure</span>
                        </div>
                        <Link href="/my-files" className="p-2.5 rounded-lg bg-white/5 text-stone-400 hover:bg-amber-600 hover:text-white transition-all">
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <Link href="/my-files" className="inline-flex items-center gap-2 text-amber-500 font-bold text-sm hover:text-amber-400 transition-colors">
                    View All Files <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* ═══ CHAPTER: ACTIVITY & NOTIFICATIONS — Dark section ═══ */}
          {clientStats && ((clientStats.activities?.length > 0) || (clientStats.notifications?.length > 0)) && (
            <section className="bg-zinc-950 text-white relative overflow-hidden">
              <div className="absolute top-6 right-8 flex items-center gap-2 text-emerald-500/60 z-10">
                <Shield className="w-4 h-4" />
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase">Audit Trail</span>
              </div>
              <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 md:py-32">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  <p className="text-amber-600 text-[11px] font-bold tracking-[0.3em] uppercase mb-4">Activity</p>
                  <h2 className="text-5xl md:text-7xl font-black text-white mb-16 leading-[0.95]" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
                    Recent Updates
                  </h2>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  {/* Activity Feed */}
                  {clientStats.activities?.length > 0 && (
                    <div>
                      <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-6 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" /> Activity Log
                      </p>
                      <div className="space-y-3">
                        {clientStats.activities.slice(0, 8).map((act: any, index: number) => (
                          <motion.div
                            key={act.id}
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-start gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                          >
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <Activity className="w-3.5 h-3.5 text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white text-sm truncate">{act.action}</p>
                              {act.content && <p className="text-stone-500 text-xs mt-1 truncate">{act.content}</p>}
                              <p className="text-stone-700 text-[10px] font-bold mt-2">{new Date(act.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notifications */}
                  {clientStats.notifications?.length > 0 && (
                    <div>
                      <p className="text-amber-600 text-[10px] font-bold tracking-[0.25em] uppercase mb-6 flex items-center gap-2">
                        <Bell className="w-3.5 h-3.5" /> Notifications
                        {clientStats.unread_notifications_count > 0 && (
                          <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-black rounded-full">
                            {clientStats.unread_notifications_count} new
                          </span>
                        )}
                      </p>
                      <div className="space-y-3">
                        {clientStats.notifications.slice(0, 8).map((notif: any, index: number) => (
                          <motion.div
                            key={notif.id}
                            initial={{ opacity: 0, x: 10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                              notif.is_read ? 'border-white/5 bg-white/[0.02]' : 'border-amber-500/20 bg-amber-500/[0.04]'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                              notif.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                              notif.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' :
                              notif.type === 'error' ? 'bg-rose-500/10 border border-rose-500/20' :
                              'bg-blue-500/10 border border-blue-500/20'
                            }`}>
                              <Bell className={`w-3.5 h-3.5 ${
                                notif.type === 'success' ? 'text-emerald-400' :
                                notif.type === 'warning' ? 'text-amber-400' :
                                notif.type === 'error' ? 'text-rose-400' :
                                'text-blue-400'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-sm truncate ${notif.is_read ? 'text-stone-300' : 'text-white'}`}>{notif.title}</p>
                              <p className="text-stone-500 text-xs mt-1 truncate">{notif.message}</p>
                              <p className="text-stone-700 text-[10px] font-bold mt-2">{new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            {!notif.is_read && <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-2" />}
                          </motion.div>
                        ))}
                      </div>
                      <div className="mt-6 text-center">
                        <Link href="/notifications" className="inline-flex items-center gap-2 text-amber-500 font-bold text-sm hover:text-amber-400 transition-colors">
                          View All Notifications <ArrowUpRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ═══ CHAPTER 05: EXPLORE — Light CTA section ═══ */}
          <section className="bg-stone-100">
            <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 md:py-32">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-amber-700 text-[11px] font-bold tracking-[0.3em] uppercase mb-4">
                  Chapter {clientStats?.pending_quotes_list?.length > 0 ? '05' : (clientStats?.active_services_list?.length > 0 ? '04' : '03')}
                </p>
                <h2
                  className="text-5xl md:text-7xl font-black text-zinc-900 mb-16 leading-[0.95]"
                  style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
                >
                  Explore
                </h2>
              </motion.div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {visibleNavCards.map((card, index) => (
                  <Link key={card.href} href={card.href}>
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.06 }}
                      whileHover={{ y: -2 }}
                      className="p-8 bg-white rounded-xl border border-stone-200/60 hover:border-amber-600/30 hover:shadow-lg transition-all group cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className={cn("p-3 rounded-xl bg-gradient-to-br", card.gradient)}>
                          <card.icon className="w-5 h-5 text-white" />
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-stone-300 group-hover:text-amber-600 transition-colors" />
                      </div>
                      <h3 className="font-black text-zinc-900 text-lg mb-1 group-hover:text-amber-700 transition-colors" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>{card.title}</h3>
                      <p className="text-sm text-stone-500 font-medium leading-relaxed">{card.description}</p>
                    </motion.div>
                  </Link>
                ))}
              </div>

              {/* Recommended Services */}
              {clientStats?.recommended_services && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="mt-16"
                >
                  <p className="text-amber-700 text-[10px] font-bold tracking-[0.25em] uppercase mb-4">Recommended For You</p>
                  <div className="flex flex-wrap gap-3">
                    {clientStats.recommended_services.split(',').map((s: string) => (
                      <span key={s} className="px-5 py-2.5 bg-white border border-stone-200 text-stone-700 font-bold text-sm rounded-lg">{s.trim()}</span>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </section>

          {/* ═══ FOOTER CTA — Dark ═══ */}
          <section className="bg-zinc-950">
            <div className="max-w-5xl mx-auto px-8 md:px-16 py-24 text-center">
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                <p className="text-stone-600 text-[11px] tracking-[0.3em] uppercase mb-6">Ready to scale?</p>
                <h2 className="text-4xl md:text-5xl font-black text-white mb-8" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>Accelerate Your Growth</h2>
                <Link href="/store" className="inline-flex items-center gap-3 px-8 py-4 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-xl transition-all text-sm tracking-wide">
                  <Briefcase className="w-5 h-5" /> Explore Services
                </Link>
                {/* Trust footer */}
                <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-center gap-8 flex-wrap">
                  <div className="flex items-center gap-2 text-stone-600">
                    <Shield className="w-4 h-4 text-emerald-500/50" />
                    <span className="text-[9px] font-bold tracking-[0.25em] uppercase">Secure Portal</span>
                  </div>
                  <div className="flex items-center gap-2 text-stone-600">
                    <Lock className="w-3.5 h-3.5 text-emerald-500/50" />
                    <span className="text-[9px] font-bold tracking-[0.25em] uppercase">Encrypted Data</span>
                  </div>
                  <div className="flex items-center gap-2 text-stone-600">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500/50" />
                    <span className="text-[9px] font-bold tracking-[0.25em] uppercase">Verified Account</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>
        </div>
      )}

      {/* FALLBACK: If stats didn't load but we're authenticated */}
      {!stats && role && (
        <motion.div variants={itemVariants} className="glass-card p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-amber-500/15 border border-amber-500/20">
              <Sparkles className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="font-bold text-white/80 text-lg">Dashboard Loading</h3>
            <p className="text-white/40 text-sm max-w-md">Your dashboard data is being prepared. Please refresh if this persists.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 btn-glow-indigo px-6 py-2.5 rounded-xl font-bold text-sm text-white"
            >
              Refresh Page
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

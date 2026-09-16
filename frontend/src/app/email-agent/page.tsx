"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Bot, Send, Sparkles, Mail, Clock, User, Globe, ChevronDown, ChevronUp,
  CheckCircle, Building2, Briefcase, Target, AtSign, FileText, Copy, Check,
  TrendingUp, Zap, Package, UserPlus
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import PageGuide from "@/components/PageGuide";

interface SentEmail {
  id: number;
  client_id: number | null;
  to_email: string;
  subject: string;
  english_body: string | null;
  spanish_body: string | null;
  recommended_services: string | null;
  manual: boolean;
  draft_json: string | null;
  sent_at: string | null;
}

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className || ""}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

function ShimmerCard() {
  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <ShimmerBlock className="w-10 h-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <ShimmerBlock className="h-4 w-48" />
          <ShimmerBlock className="h-3 w-32" />
        </div>
      </div>
      <ShimmerBlock className="h-3 w-full" />
      <ShimmerBlock className="h-3 w-3/4" />
      <div className="flex gap-2">
        <ShimmerBlock className="h-8 w-24 rounded-lg" />
        <ShimmerBlock className="h-8 w-24 rounded-lg" />
        <ShimmerBlock className="h-8 w-24 rounded-lg" />
      </div>
      <ShimmerBlock className="h-24 w-full rounded-xl" />
      <ShimmerBlock className="h-3 w-2/3" />
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function EmailAgentPage() {
  const { role } = useRole();
  const [companyName, setCompanyName] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"english" | "spanish">("english");
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/sent-emails?limit=30`)
      .then((r) => r.json())
      .then((data) => setSentEmails(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setEmailsLoading(false));
  }, []);

  const handleResearch = async () => {
    if (!companyName.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API_BASE_URL}/smart-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          company_url: companyUrl.trim() || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Research failed");
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSendManually = async () => {
    if (!result?.contact?.email || !result?.draft) return;
    setSending(true);
    setSendSuccess(null);
    try {
      const serviceNames = (result.recommended_services || []).map((s: any) => s.service_name || s).join(", ");
      const res = await fetch(`${API_BASE_URL}/send-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_email: result.contact.email,
          company_name: result.company_info?.company_name || companyName,
          subject: result.draft.subject || "",
          english_body: result.draft.english_body || result.draft.body || "",
          spanish_body: result.draft.spanish_body || "",
          recommended_services: serviceNames,
          contact_name: result.contact.name || null,
          contact_role: result.contact.role || null,
          website_url: result.company_url || result.company_info?.website || companyUrl || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to send");
      }
      const data = await res.json();
      setSendSuccess(`Client #${data.client_id} created & email recorded for ${result.contact.email}`);
      // Refresh sent emails list
      fetch(`${API_BASE_URL}/sent-emails?limit=30`)
        .then((r) => r.json())
        .then((d) => setSentEmails(Array.isArray(d) ? d : []))
        .catch(() => {});
    } catch (e: any) {
      setError(e.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  const totalSent = sentEmails.length;
  const manualCount = sentEmails.filter((e) => e.manual).length;
  const autoCount = totalSent - manualCount;

  return (
    <div className="space-y-6">
      {/* Shimmer animation keyframes */}
      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 relative overflow-hidden"
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-100 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">Email Agent</h1>
              <p className="text-slate-400 text-xs font-medium">AI-powered company research, service matching & outreach drafts</p>
            </div>
          </div>
          <div className="flex gap-4">
            {[
              { label: "Total Sent", value: totalSent, color: "text-violet-600 bg-violet-50 border-violet-200" },
              { label: "Auto", value: autoCount, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
              { label: "Manual", value: manualCount, color: "text-amber-600 bg-amber-50 border-amber-200" },
            ].map((s) => (
              <div key={s.label} className={`px-4 py-2 rounded-xl border ${s.color}`}>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-70">{s.label}</p>
                <p className="text-xl font-black">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      <PageGuide
        pageKey="email-agent"
        title="How the Email Agent works"
        description="Our AI researches companies, matches them to your services, and drafts personalized outreach emails."
        steps={[
          { icon: '🏢', text: 'Enter a company name and URL — the AI will analyze their website and identify opportunities.' },
          { icon: '🧠', text: 'The agent matches the company\'s needs to your service catalog and crafts a tailored pitch.' },
          { icon: '📧', text: 'Review the generated email in English and Spanish, then send it directly or copy the text.' },
          { icon: '📊', text: 'Track all sent emails above — see counts for auto-sent vs. manually-sent outreach.' },
        ]}
      />

      {/* Research Input */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Research a Company</p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company name (e.g. Flipkart, Zomato, Tesla)..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-300 transition-all"
                onKeyDown={(e) => e.key === "Enter" && handleResearch()}
              />
            </div>
            <button
              onClick={handleResearch}
              disabled={loading || !companyName.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-sm flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading ? "Researching..." : "Research & Draft"}
            </button>
          </div>
          <div className="relative">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              type="url"
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="Website URL (optional \u2014 improves accuracy)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-sm font-medium text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-200 focus:bg-white transition-all"
              onKeyDown={(e) => e.key === "Enter" && handleResearch()}
            />
          </div>
        </div>
      </motion.div>

      {/* Shimmer Loading State */}
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          <div className="glass-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-500 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Researching <span className="text-violet-600">{companyName}</span>...</p>
                <p className="text-[10px] text-slate-400 font-medium">Analyzing business, finding contacts, matching services & drafting email</p>
              </div>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "90%" }}
                transition={{ duration: 12, ease: "easeOut" }}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ShimmerCard />
            <ShimmerCard />
          </div>
          <ShimmerCard />
        </motion.div>
      )}

      {/* Error */}
      {error && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-6 border-rose-200 bg-rose-50">
          <p className="text-rose-600 font-bold text-sm">{error}</p>
        </motion.div>
      )}

      {/* Results */}
      {result && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Top row: Company Info + Contact */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Company Info */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="glass-card p-6 lg:col-span-2 relative overflow-hidden"
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-violet-50 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">
                      {(result.company_info?.company_name || companyName).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-800">{result.company_info?.company_name || companyName}</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {result.company_info?.likely_industry || result.company_info?.industry || "Business"}
                      </p>
                    </div>
                  </div>
                  {result.package_suggestion && (
                    <span className="px-3 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-600 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                      <Package className="w-3 h-3" /> {result.package_suggestion}
                    </span>
                  )}
                </div>

                <p className="text-slate-600 text-sm leading-relaxed mb-5">
                  {result.company_info?.summary || result.company_info?.what_they_do || "Company information loading..."}
                </p>

                {/* Quick facts */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Model", value: result.company_info?.business_model, icon: Briefcase },
                    { label: "Size", value: result.company_info?.estimated_size, icon: Building2 },
                    { label: "Market", value: result.company_info?.target_market, icon: Target },
                    { label: "Reach", value: result.company_info?.geographic_presence, icon: Globe },
                  ].filter(f => f.value).map(({ label, value, icon: Icon }) => (
                    <div key={label} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className="w-3 h-3 text-slate-400" />
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-700 truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Contact Card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6 relative overflow-hidden"
            >
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-5">
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                    <AtSign className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Business Contact</p>
                </div>

                {result.contact?.email ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Email</p>
                          <p className="text-sm font-black text-slate-800">{result.contact.email}</p>
                        </div>
                        <CopyButton text={result.contact.email} />
                      </div>
                    </div>
                    {result.contact.name && (
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Contact</p>
                        <p className="text-sm font-bold text-slate-700">{result.contact.name}</p>
                        {result.contact.role && <p className="text-xs text-slate-400">{result.contact.role}</p>}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-24 text-slate-300">
                    <AtSign className="w-8 h-8 opacity-30" />
                    <p className="text-xs text-slate-400 mt-2">No contact found</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Recommended Services */}
          {result.recommended_services?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-6 relative overflow-hidden"
            >
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-amber-50 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-5">
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
                    <Zap className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Recommended Services</p>
                </div>
                {result.email_hook && (
                  <p className="text-sm text-slate-600 italic mb-5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    &ldquo;{result.email_hook}&rdquo;
                  </p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {result.recommended_services.map((svc: any, i: number) => (
                    <div key={i} className="p-4 bg-white border border-slate-100 rounded-xl hover:border-violet-200 hover:shadow-sm transition-all">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-violet-50 text-violet-500 shrink-0 mt-0.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 text-sm">{svc.service_name}</p>
                          <p className="text-xs text-slate-400 mt-1">{svc.why_relevant}</p>
                          {svc.expected_impact && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> {svc.expected_impact}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Email Draft */}
          {result.draft && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6 relative overflow-hidden"
            >
              <div className="absolute -top-8 -right-8 w-32 h-32 bg-indigo-50 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Generated Email Draft</p>
                  </div>
                  <CopyButton text={activeTab === "english" ? (result.draft.english_body || result.draft.body || "") : (result.draft.spanish_body || "")} />
                </div>

                {/* Subject */}
                {result.draft.subject && (
                  <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Subject</p>
                      <p className="text-sm font-bold text-slate-700">{result.draft.subject}</p>
                    </div>
                    <CopyButton text={result.draft.subject} />
                  </div>
                )}

                {/* Language Tabs */}
                <div className="flex gap-2 mb-4">
                  {[
                    { key: "english" as const, label: "English" },
                    { key: "spanish" as const, label: "Espa\u00f1ol" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        activeTab === tab.key
                          ? "bg-indigo-500 text-white shadow-md"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Body */}
                <div className="bg-white border border-slate-100 rounded-xl p-5 text-sm text-slate-600 whitespace-pre-wrap leading-relaxed max-h-80 overflow-auto">
                  {activeTab === "english"
                    ? (result.draft.english_body || result.draft.body || "No English draft generated")
                    : (result.draft.spanish_body || "No Spanish draft generated")}
                </div>

                {/* Send Manually */}
                {result.contact?.email && (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <Send className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-700 flex-1">Ready to send to: {result.contact.email}</span>
                      <button
                        onClick={handleSendManually}
                        disabled={sending || !!sendSuccess}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {sending ? (
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : sendSuccess ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        {sending ? "Sending..." : sendSuccess ? "Sent" : "Send Manually"}
                      </button>
                    </div>
                    {sendSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl"
                      >
                        <p className="text-xs font-bold text-emerald-700 flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5" /> {sendSuccess}
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Recent Email Outreach */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6 md:p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-50 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-50 border border-violet-200 text-violet-600">
              <Mail className="w-4 h-4" />
            </div>
            <h3 className="font-black text-[15px] text-slate-700">Recent Email Outreach</h3>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {totalSent} total
          </span>
        </div>

        {emailsLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <ShimmerBlock className="w-9 h-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <ShimmerBlock className="h-4 w-2/3" />
                    <ShimmerBlock className="h-3 w-1/3" />
                  </div>
                  <ShimmerBlock className="h-6 w-16 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : sentEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-300 gap-3">
            <Mail className="w-10 h-10 opacity-30 text-slate-400" />
            <p className="font-bold text-sm text-slate-400">No emails sent yet</p>
            <p className="text-xs text-slate-300">Use the research tool above to start outreach</p>
          </div>
        ) : (
          <div className="space-y-2 relative z-10">
            {sentEmails.map((email, index) => {
              const isExpanded = expandedId === email.id;
              return (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="border border-slate-100 rounded-2xl overflow-hidden hover:border-slate-200 transition-all"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : email.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        email.manual ? "bg-amber-50 border border-amber-200 text-amber-600" : "bg-violet-50 border border-violet-200 text-violet-600"
                      }`}>
                        {email.manual ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-700 text-sm truncate">{email.subject || "(No subject)"}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-400 truncate flex items-center gap-1">
                            <Send className="w-3 h-3 shrink-0" /> {email.to_email}
                          </span>
                          {email.sent_at && (
                            <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1 shrink-0">
                              <Clock className="w-3 h-3" />
                              {new Date(email.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full ${
                        email.manual ? "bg-amber-50 text-amber-600 border border-amber-200" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                      }`}>
                        {email.manual ? "Manual" : "Auto"}
                      </span>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      className="border-t border-slate-100 bg-slate-50 p-5"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {email.english_body && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">English Body</p>
                              <CopyButton text={email.english_body} />
                            </div>
                            <div className="bg-white border border-slate-100 rounded-xl p-4 text-sm text-slate-600 whitespace-pre-wrap max-h-64 overflow-auto leading-relaxed">
                              {email.english_body}
                            </div>
                          </div>
                        )}
                        {email.spanish_body && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spanish Body</p>
                              <CopyButton text={email.spanish_body} />
                            </div>
                            <div className="bg-white border border-slate-100 rounded-xl p-4 text-sm text-slate-600 whitespace-pre-wrap max-h-64 overflow-auto leading-relaxed">
                              {email.spanish_body}
                            </div>
                          </div>
                        )}
                      </div>
                      {email.recommended_services && (
                        <div className="mt-4">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Recommended Services</p>
                          <div className="flex flex-wrap gap-2">
                            {email.recommended_services.split(",").map((s: string) => (
                              <span key={s} className="px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 font-bold text-xs rounded-lg">
                                {s.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> Delivered</span>
                        {email.sent_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(email.sent_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {email.client_id && <span className="flex items-center gap-1"><User className="w-3 h-3" /> Client #{email.client_id}</span>}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}

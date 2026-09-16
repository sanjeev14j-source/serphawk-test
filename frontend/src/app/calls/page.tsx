"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, Plus, X, Clock, Loader2, Check, PhoneCall, PhoneOff, Zap,
  User, FileText, Briefcase, CalendarClock, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";
import PageGuide from '@/components/PageGuide';
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120 } },
};

interface CallEntry {
  id: number;
  phone_number: string;
  received_at: string;
  duration_seconds: number | null;
  summary: string | null;
  description: string | null;
  work_done: string | null;
  assigned_to: string | null;
  followup_needed: boolean;
  followup_date: string | null;
  client_id: number | null;
}

const EMPTY_FORM = {
  phone_number: "",
  duration_seconds: "",
  description: "",
  work_done: "",
  assigned_to: "",
  followup_needed: false,
  followup_date: "",
};

function formatDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function CallDetailPanel({ call, onSave }: { call: CallEntry; onSave: () => void }) {
  const [form, setForm] = useState({
    summary: call.summary || "",
    description: call.description || "",
    work_done: call.work_done || "",
    assigned_to: call.assigned_to || "",
    followup_needed: call.followup_needed,
    followup_date: call.followup_date || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE_URL}/calls/${call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-white/60 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
            📋 Summary
          </label>
          <textarea
            rows={2}
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            placeholder="Brief call summary..."
            className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-700 resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
            📝 Description
          </label>
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What was discussed..."
            className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 text-slate-700 resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
            ✅ Work Done
          </label>
          <textarea
            rows={2}
            value={form.work_done}
            onChange={(e) => setForm({ ...form, work_done: e.target.value })}
            placeholder="Actions completed..."
            className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400 text-slate-700 resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
            👤 Assigned To
          </label>
          <input
            type="text"
            value={form.assigned_to}
            onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            placeholder="Team member name..."
            className="w-full px-4 py-2.5 bg-white/80 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 text-slate-700"
          />
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <div
            onClick={() => setForm({ ...form, followup_needed: !form.followup_needed })}
            className={cn(
              "w-11 h-6 rounded-full transition-all relative",
              form.followup_needed ? "bg-red-500" : "bg-slate-200"
            )}
          >
            <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", form.followup_needed ? "left-auto right-1" : "left-1")} />
          </div>
          <span className="text-sm font-bold text-slate-700">🔔 Follow-up Needed</span>
        </label>
        {form.followup_needed && (
          <input
            type="date"
            value={form.followup_date}
            onChange={(e) => setForm({ ...form, followup_date: e.target.value })}
            className="px-4 py-2 bg-red-50 border border-red-200 rounded-2xl text-sm font-bold text-red-700 outline-none"
          />
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-sm transition-all disabled:opacity-40"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Check className="w-4 h-4" />}
        {saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchCalls = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/calls`);
      const data = await res.json();
      setCalls(data.calls || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCalls(); }, []);

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: form.phone_number,
          duration_seconds: form.duration_seconds ? parseInt(form.duration_seconds) : null,
          description: form.description || null,
          work_done: form.work_done || null,
          assigned_to: form.assigned_to || null,
          followup_needed: form.followup_needed,
          followup_date: form.followup_date || null,
        }),
      });
      setForm(EMPTY_FORM);
      setShowModal(false);
      fetchCalls();
    } finally {
      setSubmitting(false);
    }
  };

  const needsFollowup = calls.filter((c) => c.followup_needed && !c.followup_date);
  const unsummarized = calls.filter((c) => !c.summary);

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-amber-700 to-slate-900 tracking-tight">
            Call Log
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-500 font-medium">{calls.length} total calls</p>
            {unsummarized.length > 0 && (
              <span className="text-[10px] bg-amber-100 text-amber-700 font-black px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">
                {unsummarized.length} unsummarized
              </span>
            )}
            {needsFollowup.length > 0 && (
              <span className="text-[10px] bg-red-100 text-red-700 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                {needsFollowup.length} followup needed
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              const demoCalls = [
                { phone: "+1 (555) 123-4567", duration: 145 },
                { phone: "+1 (888) 999-0000", duration: 62 },
                { phone: "+44 20 7123 4567", duration: 320 },
              ];
              const random = demoCalls[Math.floor(Math.random() * demoCalls.length)];
              try {
                await fetch(`${API_BASE_URL}/calls`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    phone_number: random.phone,
                    duration_seconds: random.duration,
                    received_at: new Date().toISOString(),
                  }),
                });
                fetchCalls();
                // Custom event to tell NotificationBar to fetch immediately
                window.dispatchEvent(new CustomEvent("refresh-calls"));
              } catch (e) {
                console.error("Simulation failed", e);
              }
            }}
            className="flex items-center gap-2 px-6 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold shadow-sm hover:bg-slate-50 transition-all"
          >
            <Zap className="w-4 h-4 text-amber-500" /> Simulate Call
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold shadow-[0_8px_20px_rgba(245,158,11,0.3)] hover:-translate-y-0.5 hover:shadow-lg transition-all"
          >
            <Plus className="w-5 h-5" /> Log Call
          </button>
        </div>
      </motion.div>

      <PageGuide
        pageKey="calls"
        title="How the Call Log works"
        description="Record, summarize, and track follow-ups for every phone call with clients and leads."
        steps={[
          { icon: '📞', text: 'Click \"Log Call\" to record a new call with the phone number, duration, and notes.' },
          { icon: '🤖', text: 'Use \"AI Summarize\" to automatically generate a summary of the call from your notes.' },
          { icon: '📅', text: 'Set follow-up dates and mark calls as needing follow-up to never miss a lead.' },
          { icon: '📝', text: 'Click any call to expand details, see the full description, and edit information.' },
        ]}
      />

      {/* Note about auto-detection */}
      <motion.div variants={itemVariants} className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
        <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-sm text-indigo-700 font-medium leading-relaxed">
          <span className="font-black">Auto-detect coming soon.</span> To auto-sync calls from your phone, a Twilio/Google Voice integration is needed. For now, log calls manually using the button above and fill in all details.
        </p>
      </motion.div>

      {/* Call List */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : calls.length === 0 ? (
        <motion.div variants={itemVariants} className="flex flex-col items-center justify-center py-28 text-slate-400 gap-4">
          <PhoneOff className="w-14 h-14 opacity-30" />
          <p className="font-bold text-lg">No calls logged yet</p>
          <button onClick={() => setShowModal(true)} className="text-amber-600 font-bold hover:underline">Log your first call</button>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {calls.map((call) => (
            <motion.div key={call.id} variants={itemVariants}
              className={cn(
                "bg-white/50 backdrop-blur-2xl border rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-6 transition-all",
                call.followup_needed ? "border-red-200" : "border-white/80"
              )}
            >
              {/* Call Header */}
              <div className="flex items-start gap-4">
                <div className={cn("p-3 rounded-2xl shrink-0", call.summary ? "bg-emerald-50 text-emerald-500" : "bg-amber-50 text-amber-500")}>
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="font-black text-slate-800 text-lg">{call.phone_number}</span>
                    {!call.summary && <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse">Needs Summary</span>}
                    {call.followup_needed && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">🔔 Follow-up</span>}
                    {call.assigned_to && <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full">👤 {call.assigned_to}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(call.duration_seconds)}</span>
                    <span>{new Date(call.received_at).toLocaleString()}</span>
                    {call.followup_date && <span className="text-red-600 font-bold">📅 Due: {call.followup_date}</span>}
                  </div>
                  {call.summary && <p className="text-sm text-slate-600 font-medium bg-white/60 p-3 rounded-2xl border border-white mt-3">{call.summary}</p>}
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                  className="shrink-0 p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                >
                  {expandedId === call.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expandable detail panel */}
              <AnimatePresence>
                {expandedId === call.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{ overflow: "hidden" }}
                  >
                    <CallDetailPanel call={call} onSave={fetchCalls} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Log Call Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-white/90 backdrop-blur-2xl rounded-[2rem] border border-white shadow-2xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto"
            >
              <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Phone className="w-5 h-5" /></div>
                Log New Call
              </h2>
              <form onSubmit={handleLogCall} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">📞 Phone Number *</label>
                    <input type="text" required placeholder="+1 (555) 000-0000"
                      value={form.phone_number}
                      onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
                      className="w-full px-4 py-3 bg-white/60 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">⏱ Duration (seconds)</label>
                    <input type="number" placeholder="e.g. 180" min={0}
                      value={form.duration_seconds}
                      onChange={(e) => setForm({ ...form, duration_seconds: e.target.value })}
                      className="w-full px-4 py-3 bg-white/60 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">👤 Assigned To</label>
                    <input type="text" placeholder="Team member..."
                      value={form.assigned_to}
                      onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                      className="w-full px-4 py-3 bg-white/60 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">📋 Description / What was Discussed</label>
                  <textarea rows={2} placeholder="Brief overview of the call..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-3 bg-white/60 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-400/30 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">✅ Work Done</label>
                  <textarea rows={2} placeholder="Tasks completed, decisions made..."
                    value={form.work_done}
                    onChange={(e) => setForm({ ...form, work_done: e.target.value })}
                    className="w-full px-4 py-3 bg-white/60 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-400/30 resize-none"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      onClick={() => setForm({ ...form, followup_needed: !form.followup_needed })}
                      className={cn("w-11 h-6 rounded-full transition-all relative cursor-pointer", form.followup_needed ? "bg-red-500" : "bg-slate-200")}
                    >
                      <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all", form.followup_needed ? "right-1" : "left-1")} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">🔔 Follow-up Needed</span>
                  </label>
                  {form.followup_needed && (
                    <input type="date"
                      value={form.followup_date}
                      onChange={(e) => setForm({ ...form, followup_date: e.target.value })}
                      className="px-4 py-2 bg-red-50 border border-red-200 rounded-2xl text-sm font-bold text-red-700 outline-none"
                    />
                  )}
                </div>

                <button type="submit" disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl font-bold shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                  Save Call Log
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

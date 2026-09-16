"use client";

import { useState, useEffect } from "react";
import {
  Plus, X, Loader2, Target, CheckCircle, Clock, Zap, Trash2
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';

interface Milestone {
  id: number;
  title: string;
  description?: string;
  project_id?: number;
  client_id?: number;
  due_date?: string;
  status: string;
  order: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  Pending:    { icon: Clock,         color: "text-slate-600",   bg: "bg-slate-100" },
  InProgress: { icon: Zap,           color: "text-blue-600",    bg: "bg-blue-100" },
  Achieved:   { icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-100" },
};

export default function MilestonesPage() {
  const { user, role } = useRole();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");

  const [form, setForm] = useState({
    title: "", description: "", client_id: "",
    due_date: "", status: "Pending", order: "0",
  });

  const isClient = role === "Client";

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    try {
      const clientId = user?.client_id;
      const url = isClient && clientId
        ? `${API_BASE_URL}/milestones?client_id=${clientId}`
        : `${API_BASE_URL}/milestones`;
      const [m, c] = await Promise.all([
        fetch(url).then(r => r.json()),
        !isClient ? fetch(`${API_BASE_URL}/clients`).then(r => r.json()) : Promise.resolve({ clients: [] }),
      ]);
      setMilestones(m.milestones || []);
      setClients(c.clients || []);
    } finally {
      setLoading(false);
    }
  }

  async function createMilestone(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description || null,
        client_id: form.client_id ? Number(form.client_id) : null,
        due_date: form.due_date || null,
        status: form.status,
        order: Number(form.order),
      }),
    });
    setShowModal(false);
    setForm({ title: "", description: "", client_id: "", due_date: "", status: "Pending", order: "0" });
    fetchAll();
    setSubmitting(false);
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`${API_BASE_URL}/milestones/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, status } : m));
  }

  async function deleteMilestone(id: number) {
    await fetch(`${API_BASE_URL}/milestones/${id}`, { method: "DELETE" });
    setMilestones(prev => prev.filter(m => m.id !== id));
  }

  const clientName = (id?: number) => {
    if (!id) return null;
    const c = clients.find(c => c.id === id);
    return c?.companyName || c?.name || `Client #${id}`;
  };

  const filtered = filterStatus === "All" ? milestones : milestones.filter(m => m.status === filterStatus);

  const achieved = milestones.filter(m => m.status === "Achieved").length;
  const inProgress = milestones.filter(m => m.status === "InProgress").length;
  const total = milestones.length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Milestones</h1>
          <p className="text-gray-500 font-medium">Track project deliverables and achievements.</p>
        </div>
        {!isClient && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg transition-all active:scale-95">
            <Plus className="w-4 h-4" /> New Milestone
          </button>
        )}
      </div>

      <PageGuide
        pageKey="milestones"
        title="How Milestones work"
        description="Track key deliverables and achievements across your projects and services."
        steps={[
          { icon: '🎯', text: 'Each milestone represents a key deliverable with a due date and completion status.' },
          { icon: '🟢', text: 'Status indicators show Pending (waiting), In Progress (active), or Achieved (done).' },
          { icon: '📊', text: 'The progress bar at the top shows overall completion across all milestones.' },
          { icon: '📅', text: 'Due dates help you and your team stay on track with project timelines.' },
        ]}
      />

      {/* Progress Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-bold text-gray-900">Overall Progress</span>
          <span className="text-sm font-bold text-gray-500">{achieved}/{total} completed</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: total ? `${(achieved / total) * 100}%` : "0%" }}
          />
        </div>
        <div className="flex gap-6 mt-3 text-sm">
          <span className="text-emerald-600 font-semibold">{achieved} achieved</span>
          <span className="text-blue-600 font-semibold">{inProgress} in progress</span>
          <span className="text-slate-500 font-semibold">{total - achieved - inProgress} pending</span>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["All", "Pending", "InProgress", "Achieved"].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)}
            className={cn("px-4 py-1.5 rounded-full text-sm font-bold border transition-all",
              filterStatus === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400")}>
            {f === "InProgress" ? "In Progress" : f}
          </button>
        ))}
      </div>

      {/* Milestones List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && <div className="text-center py-16 text-gray-400">No milestones yet</div>}
          {filtered.map(m => {
            const cfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.Pending;
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-4 group hover:shadow-md transition-all">
                <div className={cn("p-2 rounded-xl shrink-0", cfg.bg)}>
                  <cfg.icon className={cn("w-5 h-5", cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-900">{m.title}</h3>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-bold shrink-0", cfg.bg, cfg.color)}>
                      {m.status === "InProgress" ? "In Progress" : m.status}
                    </span>
                  </div>
                  {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    {m.due_date && <span>Due: {m.due_date}</span>}
                    {clientName(m.client_id) && <span>Client: {clientName(m.client_id)}</span>}
                  </div>
                </div>
                {!isClient && (
                  <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {Object.keys(STATUS_CONFIG).filter(s => s !== m.status).map(s => (
                      <button key={s} onClick={() => updateStatus(m.id, s)}
                        className="text-xs px-2 py-1 rounded-lg border font-semibold text-gray-600 hover:bg-gray-50">
                        → {s === "InProgress" ? "In Progress" : s}
                      </button>
                    ))}
                    <button onClick={() => deleteMilestone(m.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">New Milestone</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={createMilestone} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Title *</label>
                <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Milestone title..." />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Client</label>
                  <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">No client</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.companyName || c.name || `#${c.id}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

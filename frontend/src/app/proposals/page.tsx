"use client";

import { useState, useEffect } from "react";
import {
  Plus, X, Loader2, FileSignature, CheckCircle, Send,
  Clock, XCircle, DollarSign, Trash2, Eye, Edit3, Download,
  PlayCircle, MessageSquare
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';

interface Proposal {
  id: number;
  title: string;
  client_id?: number;
  client_name?: string;
  service_request_id?: number;
  content?: string;
  status: string;
  valid_until?: string;
  total_value?: number;
  signed_at?: string;
  creator_name?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  Draft:            { icon: Edit3,          color: "text-slate-600",   bg: "bg-slate-100" },
  Sent:             { icon: Send,           color: "text-blue-600",    bg: "bg-blue-100" },
  Accepted:         { icon: CheckCircle,    color: "text-emerald-600", bg: "bg-emerald-100" },
  Rejected:         { icon: XCircle,        color: "text-red-600",     bg: "bg-red-100" },
  "Demo Requested": { icon: PlayCircle,     color: "text-violet-600",  bg: "bg-violet-100" },
};

export default function ProposalsPage() {
  const { role, user } = useRole();
  const isClient = role === "Client";
  const clientId = user?.client_id;
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");

  const [form, setForm] = useState({
    title: "", client_id: "", content: "",
    valid_until: "", total_value: "",
  });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const proposalUrl = isClient && clientId
      ? `${API_BASE_URL}/proposals?client_id=${clientId}`
      : `${API_BASE_URL}/proposals`;
    const [p, c] = await Promise.all([
      fetch(proposalUrl).then(r => r.json()),
      isClient ? Promise.resolve({ clients: [] }) : fetch(`${API_BASE_URL}/clients`).then(r => r.json()),
    ]);
    setProposals(p.proposals || []);
    setClients(c.clients || []);
    setLoading(false);
  }

  async function createProposal(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        client_id: form.client_id ? Number(form.client_id) : null,
        content: form.content || null,
        valid_until: form.valid_until || null,
        total_value: form.total_value ? parseFloat(form.total_value) : null,
      }),
    });
    setShowModal(false);
    setForm({ title: "", client_id: "", content: "", valid_until: "", total_value: "" });
    fetchAll();
    setSubmitting(false);
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`${API_BASE_URL}/proposals/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchAll();
    setShowDetail(false);
  }

  async function deleteProposal(id: number) {
    await fetch(`${API_BASE_URL}/proposals/${id}`, { method: "DELETE" });
    setProposals(prev => prev.filter(p => p.id !== id));
    setShowDetail(false);
  }

  const filtered = filterStatus === "All" ? proposals : proposals.filter(p => p.status === filterStatus);

  const stats = {
    total: proposals.length,
    accepted: proposals.filter(p => p.status === "Accepted").length,
    value: proposals.filter(p => p.status === "Accepted").reduce((s, p) => s + (p.total_value || 0), 0),
    pending: proposals.filter(p => p.status === "Sent").length,
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{isClient ? "My Proposals" : "Proposals"}</h1>
          <p className="text-gray-500 font-medium">{isClient ? "View and respond to proposals sent to you." : "Create, send, and track client proposals and contracts."}</p>
        </div>
        {!isClient && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg transition-all active:scale-95">
            <Plus className="w-4 h-4" /> New Proposal
          </button>
        )}
      </div>

      <PageGuide
        pageKey="proposals"
        title={isClient ? 'Understanding Your Proposals' : 'How Proposals work'}
        description={isClient ? 'Review proposals sent by your team, accept them, request a demo, or decline.' : 'Create, send, and track proposals and contracts for your clients.'}
        steps={isClient ? [
          { icon: '📃', text: 'Each proposal shows the service, total value, validity period, and current status.' },
          { icon: '✅', text: 'Click \"Accept\" to approve a proposal, or \"Request Demo\" if you want a walkthrough first.' },
          { icon: '📅', text: 'Check the \"Valid Until\" date — proposals expire after their validity period.' },
          { icon: '⬇️', text: 'Download any proposal as a PDF for your records or to share with your team.' },
        ] : [
          { icon: '➕', text: 'Click \"New Proposal\" to draft a proposal with services, pricing, and terms.' },
          { icon: '📨', text: 'Send proposals to clients — they can Accept, Request Demo, or Decline from their dashboard.' },
          { icon: '📊', text: 'Track acceptance rates and total pipeline value from the stats bar.' },
          { icon: '🔔', text: 'You receive notifications when a client responds to any proposal.' },
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Proposals", value: stats.total, icon: FileSignature, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Accepted", value: stats.accepted, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Awaiting Response", value: stats.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Won Value", value: `$${stats.value.toFixed(2)}`, icon: DollarSign, color: "text-violet-600", bg: "bg-violet-50" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-2xl p-4 flex items-center gap-3", s.bg)}>
            <s.icon className={cn("w-6 h-6", s.color)} />
            <div>
              <p className="text-xs text-gray-500 font-semibold">{s.label}</p>
              <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["All", ...(isClient ? ["Sent", "Accepted", "Demo Requested", "Rejected"] : ["Draft", "Sent", "Accepted", "Demo Requested", "Rejected"])].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)}
            className={cn("px-4 py-1.5 rounded-full text-sm font-bold border transition-all",
              filterStatus === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400")}>
            {f}
          </button>
        ))}
      </div>

      {/* Proposal Cards */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-20 text-gray-400">No proposals found</div>
          )}
          {filtered.map(p => {
            const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.Draft;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => { setSelected(p); setShowDetail(true); }}>
                <div className="flex items-start justify-between mb-3">
                  <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold", cfg.bg, cfg.color)}>
                    <cfg.icon className="w-3 h-3" />{p.status}
                  </span>
                  {p.total_value && (
                    <span className="text-sm font-black text-gray-900">${p.total_value.toFixed(2)}</span>
                  )}
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{p.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{p.client_name || "No client"}</p>
                <div className="text-xs text-gray-400 flex justify-between">
                  <span>Created {new Date(p.created_at).toLocaleDateString()}</span>
                  {p.valid_until && <span>Valid until {p.valid_until}</span>}
                </div>
                {p.signed_at && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                    <CheckCircle className="w-3 h-3" /> Signed {new Date(p.signed_at).toLocaleDateString()}
                  </div>
                )}
                {/* Client quick actions on card */}
                {isClient && p.status === "Sent" && (
                  <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => updateStatus(p.id, "Accepted")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95">
                      <CheckCircle className="w-3.5 h-3.5" /> Accept
                    </button>
                    <button onClick={() => updateStatus(p.id, "Demo Requested")}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-xs font-bold rounded-xl hover:bg-violet-700 transition-all active:scale-95">
                      <PlayCircle className="w-3.5 h-3.5" /> Request Demo
                    </button>
                    <button onClick={() => { setSelected(p); setShowDetail(true); }}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-200 transition-all active:scale-95">
                      <Eye className="w-3.5 h-3.5" /> Review
                    </button>
                  </div>
                )}
                {isClient && p.status === "Demo Requested" && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-violet-600 font-semibold flex items-center gap-1.5">
                      <PlayCircle className="w-3.5 h-3.5" /> Demo requested — our team will reach out soon.
                    </p>
                  </div>
                )}
                {isClient && p.status === "Accepted" && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> You accepted this proposal.
                    </p>
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
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">New Proposal</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={createProposal} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Title *</label>
                <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="SEO retainer proposal for..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Client</label>
                  <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select client...</option>
                    {clients.map((c: any) => <option key={c.id} value={c.id}>{c.companyName || c.name || `Client #${c.id}`}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Total Value</label>
                  <input type="number" value={form.total_value} onChange={e => setForm(p => ({ ...p, total_value: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Valid Until</label>
                <input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Proposal Content</label>
                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={8}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
                  placeholder="Scope of work, deliverables, timeline, pricing breakdown..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Proposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selected && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {(() => { const cfg = STATUS_CONFIG[selected.status] || STATUS_CONFIG.Draft; return (
                    <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold", cfg.bg, cfg.color)}>
                      <cfg.icon className="w-3 h-3" />{selected.status}
                    </span>
                  ); })()}
                  {selected.total_value && <span className="text-sm font-black text-gray-900">${selected.total_value.toFixed(2)}</span>}
                </div>
                <h2 className="text-xl font-black text-gray-900">{selected.title}</h2>
                <p className="text-sm text-gray-500">{selected.client_name}</p>
              </div>
              <button onClick={() => setShowDetail(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {selected.content && (
              <div className="bg-gray-50 rounded-2xl p-4 mb-4 text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                {selected.content}
              </div>
            )}

            <div className="text-xs text-gray-500 mb-6 space-y-1">
              {selected.valid_until && <div>Valid until: <strong>{selected.valid_until}</strong></div>}
              {selected.signed_at && <div className="text-emerald-600">✓ Signed on {new Date(selected.signed_at).toLocaleDateString()}</div>}
            </div>

            {/* Client action area */}
            {isClient && selected.status === "Sent" && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4">
                <p className="text-sm font-bold text-blue-900 mb-3">This proposal is awaiting your response</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => updateStatus(selected.id, "Accepted")}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95 shadow-sm">
                    <CheckCircle className="w-4 h-4" /> Accept Proposal
                  </button>
                  <button onClick={() => updateStatus(selected.id, "Demo Requested")}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-all active:scale-95 shadow-sm">
                    <PlayCircle className="w-4 h-4" /> Request a Demo
                  </button>
                  <button onClick={() => updateStatus(selected.id, "Rejected")}
                    className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-100 transition-all active:scale-95">
                    <XCircle className="w-4 h-4" /> Decline
                  </button>
                </div>
              </div>
            )}
            {isClient && selected.status === "Demo Requested" && (
              <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5 mb-4">
                <p className="text-sm font-bold text-violet-800 flex items-center gap-2">
                  <PlayCircle className="w-4 h-4" /> Demo requested — our team will contact you to schedule.
                </p>
              </div>
            )}
            {isClient && selected.status === "Accepted" && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-4">
                <p className="text-sm font-bold text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> You accepted this proposal{selected.signed_at ? ` on ${new Date(selected.signed_at).toLocaleDateString()}` : ""}.
                </p>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => window.open(`${API_BASE_URL}/proposals/${selected.id}/pdf`, '_blank')}
                className="px-4 py-2 text-sm font-bold rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all flex items-center gap-1.5">
                <Download className="w-4 h-4" /> Download PDF
              </button>
              {!isClient && ["Sent", "Accepted", "Rejected", "Demo Requested"].filter(s => s !== selected.status).map(s => (
                <button key={s} onClick={() => updateStatus(selected.id, s)}
                  className={cn("px-4 py-2 text-sm font-bold rounded-xl border transition-all",
                    s === "Accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    s === "Rejected" ? "bg-red-50 text-red-700 border-red-200" :
                    s === "Demo Requested" ? "bg-violet-50 text-violet-700 border-violet-200" :
                    "bg-blue-50 text-blue-700 border-blue-200")}>
                  Mark {s}
                </button>
              ))}
              {!isClient && (
                <button onClick={() => deleteProposal(selected.id)}
                  className="px-4 py-2 text-sm font-bold rounded-xl border border-red-200 text-red-600 bg-red-50 ml-auto">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

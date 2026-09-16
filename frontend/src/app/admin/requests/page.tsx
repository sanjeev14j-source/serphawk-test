'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Inbox, Users, CheckCircle, Clock, Tag, ChevronDown, ChevronUp,
  Send, DollarSign, FileText, Briefcase, AlertCircle, Activity, MessageCircle
} from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '@/config';
import PageGuide from '@/components/PageGuide';

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700 border-amber-200',
  Quoted: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
  Delivered: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [quoteForm, setQuoteForm] = useState<Record<number, any>>({});
  const [sendingQuote, setSendingQuote] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadRequests = async () => {
    try {
      const [reqRes, empRes] = await Promise.all([
        fetch(`${API_BASE_URL}/services/requests`),
        fetch(`${API_BASE_URL}/employees`)
      ]);
      const reqData = await reqRes.json();
      const empData = await empRes.json();
      setRequests(reqData.requests || []);
      setEmployees(empData.employees || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { loadRequests(); }, []);

  const handleSendQuote = async (req: any) => {
    const form = quoteForm[req.id] || {};
    if (!form.quoted_amount || !form.quote_message) {
      showToast('Please fill in the quoted amount and message.');
      return;
    }
    setSendingQuote(req.id);
    try {
      const res = await fetch(`${API_BASE_URL}/services/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: req.id,
          quoted_amount: parseFloat(form.quoted_amount),
          quote_message: form.quote_message,
          team_info: form.team_info || null,
          quote_doc_url: form.quote_doc_url || null,
          assigned_employee_id: form.assigned_employee_id ? parseInt(form.assigned_employee_id) : null,
        })
      });
      if (res.ok) {
        showToast('Quote sent to client! ✓');
        setExpandedId(null);
        await loadRequests();
      }
    } catch (e) { console.error(e); }
    setSendingQuote(null);
  };

  const updateForm = (reqId: number, field: string, value: string) => {
    setQuoteForm(prev => ({ ...prev, [reqId]: { ...prev[reqId], [field]: value } }));
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 pb-32 space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm border border-slate-700">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-8 text-white flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl"><Inbox className="w-7 h-7" /></div>
          <div>
            <h1 className="text-2xl font-black">Service Request Board</h1>
            <p className="text-indigo-200 text-sm font-medium">Review client requests and send personalized quotes</p>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-black text-sm">
            <AlertCircle className="w-4 h-4" /> {pendingCount} Pending
          </div>
        )}
      </div>

      <PageGuide
        pageKey="admin-requests"
        title="How the Service Request Board works"
        description="Review incoming client service requests, send personalized quotes, and manage request lifecycles."
        steps={[
          { icon: '📥', text: 'New client requests appear here with status \"Pending\" — review them and send a quote.' },
          { icon: '💵', text: 'Expand any request to enter a quote amount and a personalized message to the client.' },
          { icon: '✅', text: 'Once quoted, the client can accept or decline from their Store page.' },
          { icon: '📊', text: 'Use the stats row above to see pending, quoted, accepted, and delivered counts at a glance.' },
        ]}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Requests', val: requests.length, icon: Inbox, color: 'text-slate-600' },
          { label: 'Pending Review', val: requests.filter(r => r.status === 'Pending').length, icon: Clock, color: 'text-amber-500' },
          { label: 'Quotes Sent', val: requests.filter(r => r.status === 'Quoted').length, icon: Send, color: 'text-indigo-600' },
          { label: 'Active', val: requests.filter(r => r.status === 'Accepted' || r.status === 'In Progress').length, icon: Activity, color: 'text-emerald-500' },
        ].map(({ label, val, icon: Icon, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className={`p-2 bg-slate-50 rounded-xl ${color}`}><Icon className="w-5 h-5" /></div>
            <div>
              <p className="text-2xl font-black text-slate-800">{val}</p>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 font-bold">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200">
          <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-black text-slate-700">No service requests yet.</p>
          <p className="text-slate-400 text-sm font-medium">Requests will appear here when clients submit them from the store.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const isExpanded = expandedId === req.id;
            const statusCls = STATUS_COLORS[req.status] || STATUS_COLORS['Pending'];
            return (
              <motion.div key={req.id} layout className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                {/* Request Row */}
                <div className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-black text-slate-900">{req.client_name}</h3>
                      <span className="text-slate-400 font-medium text-sm">→</span>
                      <span className="font-bold text-indigo-700">{req.service_name}</span>
                      <span className={`px-3 py-1 rounded-full border text-xs font-black uppercase tracking-wider ${statusCls}`}>
                        {req.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs font-medium text-slate-400">
                      <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {req.handler_role}</span>
                      <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> ${req.service_cost}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(req.requested_at).toLocaleDateString()}</span>
                      <span>{req.client_email}</span>
                    </div>
                    {req.quoted_amount && (
                      <div className="mt-2 inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1">
                        <span className="text-xs text-indigo-600 font-black">Quote sent: ${req.quoted_amount}</span>
                        {req.client_accepted_quote && <span className="text-xs text-emerald-600 font-black">✓ Accepted</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {(req.status === 'Accepted' || req.status === 'In Progress') && (
                      <Link href="/messages"
                        className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl font-black text-xs hover:bg-emerald-100 transition-all shadow-sm">
                        <MessageCircle className="w-4 h-4" /> Open Chat session
                      </Link>
                    )}
                    {req.status !== 'Accepted' && req.status !== 'Delivered' && req.status !== 'In Progress' && (
                      <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${isExpanded ? 'bg-slate-100 text-slate-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'}`}>
                        {req.status === 'Quoted' ? 'Edit Quote' : 'Send Quote'}
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Quote Form */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-slate-100 overflow-hidden">
                      <div className="p-6 bg-slate-50 space-y-5">
                        <h4 className="font-black text-slate-800 flex items-center gap-2">
                          <Send className="w-4 h-4 text-indigo-600" /> Send Quote to {req.client_name}
                        </h4>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3 text-emerald-500" /> Quoted Amount *</label>
                            <input type="number" step="0.01" value={quoteForm[req.id]?.quoted_amount || ''}
                              onChange={e => updateForm(req.id, 'quoted_amount', e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-bold" placeholder="e.g. 1500.00" />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Users className="w-3 h-3 text-indigo-500" /> Assign Employee</label>
                            <select value={quoteForm[req.id]?.assigned_employee_id || ''}
                              onChange={e => updateForm(req.id, 'assigned_employee_id', e.target.value)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium">
                              <option value="">— Select Employee —</option>
                              {employees.map((emp: any) => (
                                <option key={emp.id} value={emp.id}>{emp.name || emp.email}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><FileText className="w-3 h-3 text-slate-400" /> Message to Client *</label>
                          <textarea value={quoteForm[req.id]?.quote_message || ''}
                            onChange={e => updateForm(req.id, 'quote_message', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-32"
                            placeholder="Explain what's included, timelines, deliverables..." />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1"><Briefcase className="w-3 h-3 text-fuchsia-500" /> Team Information</label>
                          <textarea value={quoteForm[req.id]?.team_info || ''}
                            onChange={e => updateForm(req.id, 'team_info', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-20"
                            placeholder="Who will be handling this: names, roles, experience..." />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Proposal Document URL (optional)</label>
                          <input type="url" value={quoteForm[req.id]?.quote_doc_url || ''}
                            onChange={e => updateForm(req.id, 'quote_doc_url', e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="https://docs.google.com/... or any shareable link" />
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button onClick={() => handleSendQuote(req)} disabled={sendingQuote === req.id}
                            className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
                            {sendingQuote === req.id ? (
                              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Sending...</>
                            ) : (
                              <><Send className="w-4 h-4" /> Send Quote to Client</>
                            )}
                          </button>
                          <button onClick={() => setExpandedId(null)} className="px-6 py-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

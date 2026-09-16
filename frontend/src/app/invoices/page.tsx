"use client";

import { useState, useEffect } from "react";
import {
  Plus, X, Loader2, FileText, CheckCircle, Clock, AlertTriangle,
  DollarSign, Send, Trash2, Download, RefreshCw
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';

interface Invoice {
  id: number;
  invoice_number: string;
  client_id?: number;
  client_name?: string;
  client_email?: string;
  service_request_id?: number;
  amount: number;
  tax: number;
  total: number;
  status: string;
  due_date?: string;
  notes?: string;
  line_items: any[];
  paid_at?: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  Draft:     { icon: FileText,       color: "text-slate-600", bg: "bg-slate-100" },
  Sent:      { icon: Send,           color: "text-blue-600",  bg: "bg-blue-100" },
  Paid:      { icon: CheckCircle,    color: "text-emerald-600", bg: "bg-emerald-100" },
  Overdue:   { icon: AlertTriangle,  color: "text-red-600",   bg: "bg-red-100" },
  Partial:   { icon: Clock,          color: "text-amber-600", bg: "bg-amber-100" },
  Cancelled: { icon: X,              color: "text-gray-500",  bg: "bg-gray-100" },
};

export default function InvoicesPage() {
  const { role, user } = useRole();
  const isClient = role === "Client";
  const clientId = user?.client_id;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");

  const [form, setForm] = useState({
    client_id: "", service_request_id: "", amount: "",
    tax: "0", due_date: "", notes: "",
  });
  const [lineItems, setLineItems] = useState([{ description: "", amount: "" }]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const invoiceUrl = isClient && clientId
      ? `${API_BASE_URL}/invoices?client_id=${clientId}`
      : `${API_BASE_URL}/invoices`;
    const [inv, cl, sr] = await Promise.all([
      fetch(invoiceUrl).then(r => r.json()),
      isClient ? Promise.resolve({ clients: [] }) : fetch(`${API_BASE_URL}/clients`).then(r => r.json()),
      isClient ? Promise.resolve({ requests: [] }) : fetch(`${API_BASE_URL}/services/requests`).then(r => r.json()),
    ]);
    setInvoices(inv.invoices || []);
    setClients(cl.clients || []);
    setServiceRequests(sr.requests || []);
    setLoading(false);
  }

  function downloadInvoice(inv: Invoice) {
    window.open(`${API_BASE_URL}/invoices/${inv.id}/pdf`, '_blank');
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const items = lineItems.filter(l => l.description && l.amount);
    const totalAmount = items.reduce((s, i) => s + parseFloat(i.amount || "0"), 0) || parseFloat(form.amount);
    await fetch(`${API_BASE_URL}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Number(form.client_id),
        service_request_id: form.service_request_id ? Number(form.service_request_id) : null,
        amount: totalAmount,
        tax: parseFloat(form.tax) || 0,
        due_date: form.due_date || null,
        notes: form.notes || null,
        line_items: items.map(i => ({ description: i.description, amount: parseFloat(i.amount) })),
      }),
    });
    setShowModal(false);
    setForm({ client_id: "", service_request_id: "", amount: "", tax: "0", due_date: "", notes: "" });
    setLineItems([{ description: "", amount: "" }]);
    fetchAll();
    setSubmitting(false);
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`${API_BASE_URL}/invoices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchAll();
    setShowDetailModal(false);
  }

  async function deleteInvoice(id: number) {
    await fetch(`${API_BASE_URL}/invoices/${id}`, { method: "DELETE" });
    setInvoices(prev => prev.filter(i => i.id !== id));
    setShowDetailModal(false);
  }

  const filtered = filterStatus === "All" ? invoices : invoices.filter(i => i.status === filterStatus);

  const stats = {
    total: invoices.reduce((s, i) => s + i.total, 0),
    paid: invoices.filter(i => i.status === "Paid").reduce((s, i) => s + i.total, 0),
    overdue: invoices.filter(i => i.status === "Overdue").length,
    pending: invoices.filter(i => ["Draft", "Sent"].includes(i.status)).reduce((s, i) => s + i.total, 0),
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{isClient ? "My Invoices" : "Invoices"}</h1>
          <p className="text-gray-500 font-medium">{isClient ? "View and download your invoices." : "Track payments, generate invoices, manage billing."}</p>
        </div>
        {!isClient && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg transition-all active:scale-95">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        )}
      </div>

      <PageGuide
        pageKey="invoices"
        title={isClient ? 'Understanding Your Invoices' : 'How Invoicing works'}
        description={isClient ? 'View all invoices sent to you, check payment status, and download PDF copies.' : 'Create, send, and manage invoices for client billing and payment tracking.'}
        steps={isClient ? [
          { icon: '📄', text: 'Each invoice shows the amount, status (Draft, Sent, Paid, Overdue), and line items.' },
          { icon: '⬇️', text: 'Click the download button on any invoice to get a PDF copy for your records.' },
          { icon: '💳', text: 'Invoices marked \"Paid\" are completed. \"Sent\" invoices are awaiting your payment.' },
          { icon: '📅', text: 'Check due dates to avoid overdue payments and keep your account in good standing.' },
        ] : [
          { icon: '➕', text: 'Click \"New Invoice\" to create an invoice with line items, amounts, and a client recipient.' },
          { icon: '📨', text: 'Change invoice status from Draft → Sent → Paid to track the billing lifecycle.' },
          { icon: '📊', text: 'The stats bar shows total billed, paid, pending, and overdue amounts at a glance.' },
          { icon: '📄', text: 'Download any invoice as a professional PDF to share with clients.' },
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Billed", value: `$${stats.total.toFixed(2)}`, icon: DollarSign, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Collected", value: `$${stats.paid.toFixed(2)}`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Pending Revenue", value: `$${stats.pending.toFixed(2)}`, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
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
        {["All", "Draft", "Sent", "Paid", "Overdue", "Partial", "Cancelled"].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)}
            className={cn("px-4 py-1.5 rounded-full text-sm font-bold border transition-all",
              filterStatus === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400")}>
            {f}
          </button>
        ))}
      </div>

      {/* Invoice Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Invoice #", "Client", "Amount", "Status", "Due Date", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-gray-400">No invoices found</td></tr>
              ) : filtered.map(inv => {
                const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.Draft;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-4 py-4 font-bold text-gray-900">{inv.invoice_number}</td>
                    <td className="px-4 py-4 text-gray-700">{inv.client_name || "—"}</td>
                    <td className="px-4 py-4 font-bold text-gray-900">${inv.total.toFixed(2)}</td>
                    <td className="px-4 py-4">
                      <span className={cn("flex items-center gap-1.5 w-fit px-3 py-1 rounded-full text-xs font-bold", cfg.bg, cfg.color)}>
                        <cfg.icon className="w-3 h-3" />{inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500">{inv.due_date || "—"}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setSelectedInvoice(inv); setShowDetailModal(true); }}
                          className="text-indigo-600 font-semibold text-xs hover:underline">View</button>
                        {inv.status === 'Draft' && !isClient && (
                          <button onClick={() => updateStatus(inv.id, 'Sent')}
                            className="text-blue-600 font-semibold text-xs hover:underline">Send</button>
                        )}
                        <button onClick={() => downloadInvoice(inv)}
                          className="text-gray-500 hover:text-gray-800 transition-colors" title="Download">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">New Invoice</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={createInvoice} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Client *</label>
                <select required value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select client...</option>
                  {clients.map((c: any) => <option key={c.id} value={c.id}>{c.companyName || c.name || `Client #${c.id}`}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Line Items</label>
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input value={item.description} onChange={e => setLineItems(p => p.map((l, i) => i === idx ? { ...l, description: e.target.value } : l))}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Description..." />
                    <input type="number" value={item.amount} onChange={e => setLineItems(p => p.map((l, i) => i === idx ? { ...l, amount: e.target.value } : l))}
                      className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="$0" />
                    {lineItems.length > 1 && (
                      <button type="button" onClick={() => setLineItems(p => p.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setLineItems(p => [...p, { description: "", amount: "" }])}
                  className="text-xs text-indigo-600 font-semibold hover:underline">+ Add Line Item</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tax ($)</label>
                  <input type="number" value={form.tax} onChange={e => setForm(p => ({ ...p, tax: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Due Date</label>
                  <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Payment terms, notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {showDetailModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs text-gray-500 font-semibold">{selectedInvoice.invoice_number}</p>
                <h2 className="text-xl font-black">{selectedInvoice.client_name}</h2>
              </div>
              <button onClick={() => setShowDetailModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Line items */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-4 space-y-2">
              {selectedInvoice.line_items?.map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.description}</span>
                  <span className="font-bold">${Number(item.amount).toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Tax</span><span>${selectedInvoice.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg font-black">
                <span>Total</span><span>${selectedInvoice.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm text-gray-600 mb-6">
              <div>Status: <span className="font-bold">{selectedInvoice.status}</span></div>
              <div>Due: <span className="font-bold">{selectedInvoice.due_date || "—"}</span></div>
              {selectedInvoice.notes && <div className="col-span-2">Notes: {selectedInvoice.notes}</div>}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button onClick={() => downloadInvoice(selectedInvoice)}
                className="px-4 py-2 text-sm font-bold rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all flex items-center gap-1.5">
                <Download className="w-4 h-4" /> Download
              </button>
              {!isClient && ["Sent", "Paid", "Overdue", "Cancelled"].filter(s => s !== selectedInvoice.status).map(s => (
                <button key={s} onClick={() => updateStatus(selectedInvoice.id, s)}
                  className={cn("px-4 py-2 text-sm font-bold rounded-xl border transition-all",
                    s === "Paid" ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" :
                    s === "Overdue" ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" :
                    "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100")}>
                  Mark {s}
                </button>
              ))}
              {!isClient && (
                <button onClick={() => deleteInvoice(selectedInvoice.id)}
                  className="px-4 py-2 text-sm font-bold rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 ml-auto">
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

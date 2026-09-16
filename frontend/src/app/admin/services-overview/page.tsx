'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid, Users, Briefcase, Tag, Clock, Package, Activity,
  Search, ChevronRight, X, DollarSign, UserCheck, Calendar,
  CheckCircle, Loader, Send, FileText, AlertCircle, Zap
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import PageGuide from '@/components/PageGuide';
import { useRole } from '@/context/RoleContext';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ServiceRequest {
  id: number;
  status: string;
  service_id: number;
  service_name: string;
  client_id: number;
  client_name: string;
  client_email: string;
  assigned_employee_id: number | null;
  assigned_employee_name: string | null;
  quoted_amount: number | null;
  quote_message: string | null;
  quote_doc_url: string | null;
  team_info: string | null;
  requested_at: string;
  quote_sent_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any; progress: number }> = {
  Pending:      { label: 'Pending',      color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   icon: Clock,        progress: 10  },
  Quoted:       { label: 'Quoted',       color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    icon: Send,         progress: 30  },
  Accepted:     { label: 'Accepted',     color: 'text-indigo-700',  bg: 'bg-indigo-50',   border: 'border-indigo-200',  icon: CheckCircle,  progress: 50  },
  'In Progress':{ label: 'In Progress',  color: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-200',  icon: Loader,       progress: 75  },
  Delivered:    { label: 'Delivered',    color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: Zap,          progress: 100 },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200', icon: AlertCircle, progress: 0 };
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black border', cfg.color, cfg.bg, cfg.border)}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

function ProgressBar({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  const pct = cfg?.progress ?? 0;
  const color = status === 'Delivered' ? 'bg-emerald-500' : status === 'In Progress' ? 'bg-violet-500' : status === 'Accepted' ? 'bg-indigo-500' : status === 'Quoted' ? 'bg-blue-400' : 'bg-amber-400';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</span>
        <span className="text-[11px] font-black text-slate-600">{pct}%</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
    </div>
  );
}

export default function ServicesOverviewPage() {
  const { role } = useRole();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [selected, setSelected] = useState<ServiceRequest | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/services/requests`)
      .then(r => r.json())
      .then(d => { setRequests(d.requests || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (role !== 'Admin' && role !== 'Employee') {
    return <div className="p-20 text-center text-red-500 font-bold">Unauthorized access.</div>;
  }

  const byStatus = requests.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  const totalRevenue = requests.filter(r => r.quoted_amount).reduce((s, r) => s + (r.quoted_amount ?? 0), 0);

  const filtered = requests.filter(r => {
    const matchSearch = !search ||
      r.service_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.client_email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statuses = ['All', 'Pending', 'Quoted', 'Accepted', 'In Progress', 'Delivered'];

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">Services Overview</h1>
              <p className="text-slate-400 text-sm font-medium mt-0.5">All client service requests — click any row for full details</p>
            </div>
          </div>
          <Link href="/admin/services" className="btn-glow-indigo px-5 py-2.5 rounded-xl text-white font-bold text-sm flex items-center gap-2 shrink-0 w-fit">
            <Tag className="w-4 h-4" /> Manage Catalog
          </Link>
        </div>
      </div>

      <PageGuide
        pageKey="admin-services-overview"
        title="How Services Overview works"
        description="A bird\'s-eye view of every client service request across the organization."
        steps={[
          { icon: '📊', text: 'Stats cards show total requests, active work, pending reviews, and total revenue.' },
          { icon: '🔍', text: 'Use the search bar to find any request by service name, client, or status.' },
          { icon: '📄', text: 'Click any row to expand it and see full details, timeline, and assigned team.' },
          { icon: '🏷️', text: 'Click \"Manage Catalog\" to add or edit service offerings in the catalog builder.' },
        ]}
      />

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Requests', value: requests.length,                                                           icon: Package,     color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-100'  },
          { label: 'Active Work',    value: (byStatus['In Progress'] || 0) + (byStatus['Accepted'] || 0),             icon: Activity,    color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-100'  },
          { label: 'Pending Review', value: byStatus['Pending'] || 0,                                                 icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100'    },
          { label: 'Total Revenue',  value: `$${totalRevenue.toLocaleString()}`,                                      icon: DollarSign,  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100'},
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <div className={cn('p-2.5 rounded-xl border', s.bg)}>
              <s.icon className={cn('w-4 h-4', s.color)} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              <p className="text-xl font-black text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by service, client name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                'px-3 py-2 rounded-lg text-[12px] font-bold border transition-all',
                filterStatus === s
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
              )}
            >
              {s}{s !== 'All' && byStatus[s] ? ` (${byStatus[s]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="glass-card p-20 flex flex-col items-center gap-4 text-slate-400">
          <Activity className="w-8 h-8 animate-spin" />
          <p className="font-bold text-sm">Loading service requests...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-20 flex flex-col items-center gap-4 text-slate-400">
          <Package className="w-12 h-12 text-slate-200" />
          <p className="font-black text-slate-600 text-lg">No requests found</p>
          <p className="text-sm">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_40px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <span>Service</span>
            <span>Client</span>
            <span>Assigned To</span>
            <span>Quoted</span>
            <span>Status</span>
            <span />
          </div>
          <div className="divide-y divide-slate-50">
            <AnimatePresence>
              {filtered.map((req, i) => (
                <motion.button
                  key={req.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(req)}
                  className="w-full grid grid-cols-[2fr_2fr_1.5fr_1fr_1fr_40px] gap-4 px-5 py-4 items-center hover:bg-indigo-50/50 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 text-sm truncate group-hover:text-indigo-700 transition-colors">{req.service_name}</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{new Date(req.requested_at).toLocaleDateString()}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700 text-sm truncate">{req.client_name || '—'}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">{req.client_email}</p>
                  </div>
                  <div>
                    {req.assigned_employee_name
                      ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold"><UserCheck className="w-3 h-3 text-indigo-500" />{req.assigned_employee_name}</span>
                      : <span className="text-[11px] text-slate-300 font-medium">Unassigned</span>
                    }
                  </div>
                  <div>
                    {req.quoted_amount != null
                      ? <span className="font-black text-emerald-700 text-sm">${req.quoted_amount.toLocaleString()}</span>
                      : <span className="text-[11px] text-slate-300 font-medium">—</span>
                    }
                  </div>
                  <StatusBadge status={req.status} />
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors justify-self-end" />
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Detail Drawer ── */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
            />
            {/* Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 36 }}
              className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Drawer header */}
              <div className="flex items-start justify-between p-6 border-b border-slate-100 shrink-0">
                <div>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Service Request #{selected.id}</p>
                  <h2 className="text-xl font-black text-slate-800">{selected.service_name}</h2>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* Status + Progress */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Current Status</span>
                    <StatusBadge status={selected.status} />
                  </div>
                  <ProgressBar status={selected.status} />
                  {/* Status timeline */}
                  <div className="flex items-center gap-0 mt-2">
                    {['Pending','Quoted','Accepted','In Progress','Delivered'].map((s, i, arr) => {
                      const allStatuses = ['Pending','Quoted','Accepted','In Progress','Delivered'];
                      const currentIdx = allStatuses.indexOf(selected.status);
                      const done = i <= currentIdx;
                      return (
                        <React.Fragment key={s}>
                          <div className="flex flex-col items-center gap-1">
                            <div className={cn('w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all', done ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200')}>
                              {done && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <span className={cn('text-[9px] font-bold whitespace-nowrap', done ? 'text-indigo-600' : 'text-slate-300')}>{s}</span>
                          </div>
                          {i < arr.length - 1 && (
                            <div className={cn('flex-1 h-0.5 mb-4 transition-all', done && i < currentIdx ? 'bg-indigo-600' : 'bg-slate-200')} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Who ordered */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-500" /> Client
                  </p>
                  <div className="p-4 rounded-2xl border border-slate-100 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm">
                        {selected.client_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{selected.client_name || '—'}</p>
                        <p className="text-[11px] text-slate-400">{selected.client_email}</p>
                      </div>
                    </div>
                    <Link
                      href={`/admin/clients/${selected.client_id}`}
                      className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg text-[11px] font-bold hover:bg-indigo-100 transition-colors"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Pricing
                  </p>
                  <div className="p-4 rounded-2xl border border-slate-100 bg-white">
                    {selected.quoted_amount != null ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[11px] text-slate-400 font-medium">Quoted Amount</p>
                          <p className="text-3xl font-black text-emerald-700">${selected.quoted_amount.toLocaleString()}</p>
                        </div>
                        {selected.quote_sent_at && (
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-medium">Quote Sent</p>
                            <p className="text-sm font-bold text-slate-600">{new Date(selected.quote_sent_at).toLocaleDateString()}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 font-medium italic">No quote issued yet.</p>
                    )}
                    {selected.quote_message && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quote Note</p>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{selected.quote_message}</p>
                      </div>
                    )}
                    {selected.quote_doc_url && (
                      <a href={selected.quote_doc_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700">
                        <FileText className="w-3.5 h-3.5" /> View Proposal Document
                      </a>
                    )}
                  </div>
                </div>

                {/* Team */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-violet-500" /> Team Handling
                  </p>
                  <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-3">
                    {selected.assigned_employee_name ? (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 font-black text-sm">
                          {selected.assigned_employee_name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Employee</p>
                          <p className="font-bold text-slate-800 text-sm">{selected.assigned_employee_name}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 font-medium italic">No employee assigned yet.</p>
                    )}
                    {selected.team_info && (
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Team Notes</p>
                        <p className="text-sm text-slate-600 font-medium leading-relaxed">{selected.team_info}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-sky-500" /> Timeline
                  </p>
                  <div className="p-4 rounded-2xl border border-slate-100 bg-white grid grid-cols-2 gap-4">
                    {[
                      { label: 'Requested',  value: selected.requested_at  },
                      { label: 'Quote Sent', value: selected.quote_sent_at },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-slate-700">
                          {value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drawer footer */}
              <div className="p-4 border-t border-slate-100 shrink-0 flex gap-3">
                <Link
                  href="/admin/requests"
                  className="flex-1 text-center px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Manage in Request Board
                </Link>
                <Link
                  href={`/admin/clients/${selected.client_id}`}
                  className="flex-1 text-center btn-glow-indigo px-4 py-2.5 rounded-xl text-white font-bold text-sm"
                >
                  Open Client
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

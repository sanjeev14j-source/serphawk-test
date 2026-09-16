'use client';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Search, MousePointerClick, TrendingUp, BarChart3, LineChart, Users, Eye, DollarSign, FolderKanban, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import PageGuide from '@/components/PageGuide';

interface MonitorData {
  total_keywords: number;
  avg_position: number;
  keyword_rows: { keyword: string; position: number; url: string; search_engine: string; recorded_at: string }[];
  total_projects: number;
  completed_projects: number;
  avg_progress: number;
  total_revenue: number;
  paid_revenue: number;
  pending_revenue: number;
  weekly_activity: { week: string; count: number }[];
}

export default function MonitorPage() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/monitor-stats`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const kpis = [
    { title: 'Keywords Tracked', val: data?.total_keywords ?? 0, sub: `${data?.keyword_rows?.length ?? 0} recent entries`, icon: Search, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { title: 'Avg. Position', val: data?.avg_position ?? '—', sub: 'Across all keywords', icon: TrendingUp, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' },
    { title: 'Total Revenue', val: `$${(data?.total_revenue ?? 0).toLocaleString()}`, sub: `$${(data?.paid_revenue ?? 0).toLocaleString()} paid`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Projects', val: `${data?.completed_projects ?? 0}/${data?.total_projects ?? 0}`, sub: `${data?.avg_progress ?? 0}% avg progress`, icon: FolderKanban, color: 'text-sky-600', bg: 'bg-sky-50' },
  ];

  const maxActivity = Math.max(...(data?.weekly_activity?.map(w => w.count) || [1]), 1);

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-8">
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><Activity className="w-8 h-8"/></div>
             Live Monitoring & Analytics
          </h1>
          <p className="text-slate-500 font-medium mt-2">Real-time keyword tracking and business insights from your CRM data.</p>
        </div>
        <div className="flex gap-3">
             <div className="px-4 py-2 bg-slate-100 rounded-xl flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-slate-600">Live Data</span>
             </div>
        </div>
      </div>

      <PageGuide
        pageKey="monitor"
        title="How Live Monitoring works"
        description="Real-time dashboard showing your keyword performance, project stats, and revenue insights."
        steps={[
          { icon: '📊', text: 'KPI cards at the top show live data: keywords tracked, average position, clicks, and revenue.' },
          { icon: '📈', text: 'The activity chart visualizes weekly keyword performance trends over time.' },
          { icon: '🔍', text: 'The keyword table shows each tracked keyword with its position, URL, and search engine.' },
          { icon: '🟢', text: 'Data refreshes from your CRM automatically — the green \"Live Data\" badge confirms real-time sync.' },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid lg:grid-cols-4 gap-6">
         {kpis.map((kpi, i) => (
           <motion.div key={i} initial={{opacity: 0, y: 20}} animate={{opacity: 1, y: 0}} transition={{delay: i * 0.1}} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                 <div className={`p-3 rounded-2xl ${kpi.bg} ${kpi.color}`}>
                    <kpi.icon className="w-6 h-6" />
                 </div>
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{kpi.title}</p>
                 <p className="text-3xl font-black text-slate-800">{kpi.val}</p>
                 <p className="text-xs font-bold text-emerald-500 mt-2">{kpi.sub}</p>
              </div>
           </motion.div>
         ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
         {/* Live Ranking Tracker */}
         <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="font-black text-slate-800 flex items-center gap-2">
                 <TrendingUp className="w-5 h-5 text-indigo-500"/> SEO Ranking Tracker
               </h3>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b border-slate-100">
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest pl-6">Keyword</th>
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Position</th>
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Engine</th>
                     <th className="p-4 text-xs font-bold text-slate-400 uppercase tracking-widest pr-6">Recorded</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                   {(data?.keyword_rows || []).length === 0 ? (
                     <tr><td colSpan={4} className="p-6 text-center text-sm text-slate-400">No keyword rankings logged yet. Go to Rankings → Log Ranking to start tracking.</td></tr>
                   ) : (
                     data!.keyword_rows.map((k, i) => (
                       <tr key={i} className="hover:bg-slate-50 transition-colors">
                         <td className="p-4 pl-6 font-bold text-slate-800 text-sm">{k.keyword}</td>
                         <td className="p-4 font-black text-slate-700">{k.position}</td>
                         <td className="p-4 text-sm text-slate-500">{k.search_engine}</td>
                         <td className="p-4 pr-6 text-xs text-slate-400">{k.recorded_at ? new Date(k.recorded_at).toLocaleDateString() : '—'}</td>
                       </tr>
                     ))
                   )}
                 </tbody>
               </table>
            </div>
         </motion.div>

         {/* Weekly Activity Chart */}
         <motion.div initial={{opacity: 0, scale: 0.95}} animate={{opacity: 1, scale: 1}} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-black text-slate-800 flex items-center gap-2">
                 <BarChart3 className="w-5 h-5 text-indigo-500"/> Weekly Activity
               </h3>
            </div>
            
            <div className="relative h-64 w-full flex items-end gap-2 border-b border-l border-slate-100 p-4">
               {(data?.weekly_activity || []).map((w, i) => (
                  <div key={i} className="relative flex-1 group flex flex-col justify-end items-center h-full">
                     <motion.div 
                       initial={{ height: 0 }} 
                       animate={{ height: `${(w.count / maxActivity) * 100}%` }} 
                       transition={{ delay: i * 0.05 }}
                       className="w-full bg-gradient-to-t from-indigo-500 to-indigo-300 rounded-t-lg hover:from-fuchsia-500 hover:to-fuchsia-300 transition-colors cursor-pointer min-h-[3px]"
                       title={`${w.count} activities`}
                     />
                     <span className="text-[9px] font-bold text-slate-400 mt-2">{w.week}</span>
                  </div>
               ))}
            </div>

            <div className="mt-8 grid grid-cols-3 gap-4">
               <div className="p-4 border border-slate-100 rounded-2xl text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Revenue</p>
                  <p className="text-xl font-black text-slate-800 mt-1">${(data?.total_revenue ?? 0).toLocaleString()}</p>
               </div>
               <div className="p-4 border border-slate-100 rounded-2xl text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paid</p>
                  <p className="text-xl font-black text-emerald-600 mt-1">${(data?.paid_revenue ?? 0).toLocaleString()}</p>
               </div>
               <div className="p-4 border border-slate-100 rounded-2xl text-center">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pending</p>
                  <p className="text-xl font-black text-amber-600 mt-1">${(data?.pending_revenue ?? 0).toLocaleString()}</p>
               </div>
            </div>
         </motion.div>
      </div>
    </div>
  );
}

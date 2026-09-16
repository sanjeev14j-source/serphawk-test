'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ExternalLink, MessageCircle, ArrowLeft, Activity, Briefcase, FileText, BarChart, Zap } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import Link from 'next/link';
import { useRole } from '@/context/RoleContext';
import PageGuide from '@/components/PageGuide';

export default function AdminClientXRayPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useRole();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE_URL}/admin/client-xray/${params.id}`)
      .then(res => res.json())
      .then(d => {
         setData(d);
         setLoading(false);
      })
      .catch(err => {
         console.error(err);
         setLoading(false);
      });
  }, [params.id]);

  if (role !== 'Admin' && role !== 'Employee') {
     return <div className="p-20 text-center text-red-500 font-bold">Unauthorized. Restricted Access.</div>;
  }

  if (loading) return <div className="p-20 text-center font-bold text-slate-400 animate-pulse">Loading Client X-Ray...</div>;
  if (!data || !data.client) return <div className="p-20 text-center text-red-500 font-bold">Client not found.</div>;

  const { client, active_services = [], latest_audit, latest_analytics } = data;

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
         <button onClick={() => router.back()} className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600"/>
         </button>
         <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
               {client.name} <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] uppercase tracking-widest rounded-full">{client.status}</span>
            </h1>
            <p className="text-slate-500 font-medium flex items-center gap-2 mt-1">
               {client.websiteUrl ? <a href={client.websiteUrl} target="_blank" className="hover:text-indigo-600 hover:underline flex items-center gap-1">{client.websiteUrl} <ExternalLink className="w-3 h-3"/></a> : "No Website Given"}
               {client.sitemap_url && <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-400">Sitemap Verified</span>}
            </p>
         </div>
         <div className="ml-auto flex gap-3">
            <Link href={`/messages`} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-xl transition-all shadow-md flex items-center gap-2">
               <MessageCircle className="w-5 h-5"/> Open Comm Hub
            </Link>
         </div>
      </div>

      <PageGuide
        pageKey="admin-client-xray"
        title="How the Client X-Ray works"
        description="A complete 360° view of this client — their services, audit data, and analytics in one place."
        steps={[
          { icon: '💼', text: 'Active Services section shows all service requests this client has made and their current status.' },
          { icon: '📊', text: 'Latest Audit and Analytics cards show their most recent SEO performance data.' },
          { icon: '💬', text: 'Click \"Open Comm Hub\" to jump directly to the messaging thread for this client.' },
          { icon: '⬅️', text: 'Use the back arrow to return to the full client list.' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* ACTIVE SERVICES MIRROR */}
         <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Briefcase className="w-6 h-6"/></div>
               <h2 className="text-xl font-black text-slate-900">Active Services Requested</h2>
            </div>
            
            {active_services.length === 0 ? (
               <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 font-medium">
                  Client has not requested any services yet.
               </div>
            ) : (
               <div className="grid gap-4">
                  {active_services.map((svc: any) => (
                     <div key={svc.request_id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between shadow-sm">
                        <div>
                           <div className="flex items-center gap-2 mb-2">
                              {svc.status === 'Pending' ? (
                                 <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest rounded border border-amber-200">Pending Assignment</span>
                              ) : (
                                 <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-widest rounded border border-emerald-200">Active - {svc.status}</span>
                              )}
                              <span className="text-xs text-slate-400 font-medium">{new Date(svc.requested_at).toLocaleDateString()}</span>
                           </div>
                           <h3 className="font-bold text-slate-900 text-lg">{svc.service_name}</h3>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Handler</p>
                           <p className="font-bold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">{svc.assigned_employee_name}</p>
                        </div>
                     </div>
                  ))}
               </div>
            )}

            {/* AUDIT MIRROR */}
            <div className="flex items-center gap-3 mb-6 mt-12">
               <div className="p-2 bg-fuchsia-50 text-fuchsia-600 rounded-xl"><FileText className="w-6 h-6"/></div>
               <h2 className="text-xl font-black text-slate-900">Latest SEO Audit Mirror</h2>
            </div>

            {latest_audit ? (
               <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between gap-8">
                  <div className="flex-1">
                     <p className="text-sm font-medium text-slate-500 mb-2">Audit generated on {new Date(latest_audit.last_run).toLocaleDateString()}</p>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Health Score</p>
                           <p className="text-2xl font-black text-slate-800 flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-500"/> {latest_audit.health_score || 0}/100</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Desktop Speed</p>
                           <p className="text-2xl font-black text-slate-800 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500"/> {latest_audit.page_speed_desktop || '--'}</p>
                        </div>
                     </div>
                  </div>
                  <div className="shrink-0 p-6 bg-fuchsia-50 rounded-full flex flex-col items-center justify-center w-32 h-32 border border-fuchsia-100">
                     <span className="text-xs font-black uppercase text-fuchsia-600 mb-1">Core Vitals</span>
                     <span className="text-lg font-black text-fuchsia-700">{latest_audit.core_web_vitals_passed ? 'PASSED' : 'FAILED'}</span>
                  </div>
               </div>
            ) : (
               <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center text-slate-400 font-medium">
                  Client has not triggered an Audit yet.
               </div>
            )}
         </div>

         {/* LIVE MONITOR SIDEBAR */}
         <div className="lg:col-span-1 space-y-6">
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-8 rounded-[2.5rem] text-white shadow-xl">
               <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-white/10 rounded-xl"><BarChart className="w-5 h-5"/></div>
                  <h3 className="font-black text-lg">Live Analytics Mirror</h3>
               </div>
               
               {latest_analytics ? (
                  <div className="space-y-6">
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">Monthly Organic Traffic (GA4)</p>
                        <p className="text-4xl font-black text-white">{latest_analytics.sessions.toLocaleString()}</p>
                     </div>
                     <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">GSC Impressions</p>
                        <p className="text-2xl font-bold text-white/90">{latest_analytics.gsc_impressions.toLocaleString()}</p>
                     </div>
                     <div className="pt-4 border-t border-white/10 flex justify-between">
                        <div>
                           <p className="text-[10px] font-black uppercase text-indigo-300">Avg CTR</p>
                           <p className="font-bold">{latest_analytics.gsc_ctr}%</p>
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase text-indigo-300">Avg Pos</p>
                           <p className="font-bold">{latest_analytics.gsc_position}</p>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="text-center py-10 opacity-60">
                     <p className="font-medium">No GA4/GSC connection established by client.</p>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}

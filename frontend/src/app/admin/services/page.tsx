'use client';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Tag, DollarSign, Image as ImageIcon, Users, FileText, Activity, Layers, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import PageGuide from '@/components/PageGuide';

export default function AdminServicesPage() {
  const { role } = useRole();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    intro_description: '',
    full_description: '',
    handler_role: 'Employee',
    image_url: '',
    past_results: ''
  });

  if (role !== 'Admin' && role !== 'Employee') {
     return <div className="p-10 text-center text-red-500 font-bold">Unauthorized. Admins only.</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cost: parseFloat(formData.cost) || 0
        })
      });
      if (res.ok) {
        setSuccess(true);
        setFormData({
            name: '', cost: '', intro_description: '', full_description: '',
            handler_role: 'Employee', image_url: '', past_results: ''
        });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
               <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><Layers className="w-8 h-8"/></div>
               Service Catalog Builder
            </h1>
            <p className="text-slate-500 font-medium mt-2">Create rich service offerings for clients to browse and purchase.</p>
         </div>
      </div>

      <PageGuide
        pageKey="admin-services"
        title="How the Service Catalog Builder works"
        description="Create and manage the services your clients can browse and purchase from the Store."
        steps={[
          { icon: '🛠️', text: 'Fill out the form below with service name, cost, descriptions, and an image URL.' },
          { icon: '🏷️', text: 'Set a handler role (who manages this service) — it appears in the client\'s Store page.' },
          { icon: '💰', text: 'The cost you set here is the amount clients will see when requesting a quote.' },
          { icon: '📝', text: 'Add a short and long description plus past results to make the service compelling.' },
        ]}
      />

      <motion.form 
        initial={{opacity: 0, y: 20}} 
        animate={{opacity: 1, y: 0}}
        onSubmit={handleSubmit} 
        className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-6"
      >
         <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <Tag className="w-4 h-4 text-indigo-400"/> Service Name
                </label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder="e.g. Technical SEO Deep Dive" />
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <DollarSign className="w-4 h-4 text-emerald-400"/> Price ($)
                </label>
                <input required type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" placeholder="499.00" />
            </div>
         </div>

         <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400"/> Short Intro (Visible on Cart Card)
            </label>
            <textarea required maxLength={150} value={formData.intro_description} onChange={e => setFormData({...formData, intro_description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-24" placeholder="A brief punchy description..." />
         </div>

         <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400"/> Full Detailed Description
            </label>
            <textarea value={formData.full_description} onChange={e => setFormData({...formData, full_description: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[150px]" placeholder="Everything included in this service..." />
         </div>

         <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <Users className="w-4 h-4 text-fuchsia-400"/> Handled By (Role/Team)
                </label>
                <input required type="text" value={formData.handler_role} onChange={e => setFormData({...formData, handler_role: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-fuchsia-500 focus:outline-none" placeholder="e.g. SEO Specialist / Content Team" />
            </div>

            <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <ImageIcon className="w-4 h-4 text-sky-400"/> Cover Image URL
                </label>
                <input type="url" value={formData.image_url} onChange={e => setFormData({...formData, image_url: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none" placeholder="https://example.com/image.jpg" />
            </div>
         </div>

         <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-400"/> Past Experience / Results
            </label>
            <textarea value={formData.past_results} onChange={e => setFormData({...formData, past_results: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none h-24" placeholder="Increased organic traffic by 300% for an e-commerce brand..." />
         </div>

         <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            {success ? (
               <motion.div initial={{opacity:0, x:-10}} animate={{opacity:1, x:0}} className="flex items-center gap-2 text-emerald-600 font-bold bg-emerald-50 px-4 py-2 rounded-xl">
                  <CheckCircle className="w-5 h-5"/> Service Published to Store
               </motion.div>
            ) : <div />}
            <button disabled={loading} type="submit" className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
               <Plus className="w-5 h-5"/> {loading ? 'Publishing...' : 'Publish Service'}
            </button>
         </div>
      </motion.form>
    </div>
  );
}

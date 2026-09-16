"use client";

import { useState, useEffect } from "react";
import { Activity, UserPlus, Search, MoreVertical, Mail, Trash2, X, Check, Loader2, Key } from "lucide-react";
import { API_BASE_URL } from '@/config';
import { cn } from "@/lib/utils";
import PageGuide from '@/components/PageGuide';

export default function InternsPage() {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const fetchInterns = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/interns`);
      const data = await res.json();
      setInterns(data.interns || []);
    } catch (error) {
      console.error("Failed to fetch interns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterns();
  }, []);

  const handleAddIntern = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role: 'Intern' })
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchInterns();
        setName("");
        setEmail("");
        setPassword("");
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to create intern");
      }
    } catch (error) {
      console.error("Failed to add intern:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this intern?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchInterns();
    } catch (error) {
      console.error("Failed to delete intern:", error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Intern Management</h1>
          <p className="text-gray-500 font-medium">Provision and manage supporting talent accounts.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg shadow-gray-900/20 transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" /> Add Intern
        </button>
      </div>

      <PageGuide
        pageKey="interns"
        title="How Intern Management works"
        description="Create and manage intern accounts who can assist on projects and tasks."
        steps={[
          { icon: '🎓', text: 'Click \"Add Intern\" to provision a new intern with login credentials.' },
          { icon: '📋', text: 'Interns can be assigned to projects and tasks but have limited system access.' },
          { icon: '🔒', text: 'You can reset passwords or remove intern accounts at any time from the action menu.' },
          { icon: '👁️', text: 'Interns can view project boards and update task statuses assigned to them.' },
        ]}
      />

      <div className="bg-white rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
           <div className="relative w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search interns..." className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
           </div>
           <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">{interns.length} ACCESS TOKENS ACTIVE</p>
        </div>
        
        <div className="p-4 overflow-x-auto">
           <table className="w-full">
              <thead>
                 <tr className="text-left">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Credentials</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {loading ? (
                   [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={4} className="h-16 px-6"></td></tr>)
                 ) : interns.length > 0 ? (
                   interns.map((intern: any) => (
                     <tr key={intern.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs">
                                 {intern.name?.charAt(0)}
                              </div>
                              <span className="font-bold text-gray-900">{intern.name}</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-400 italic">{intern.email}</td>
                        <td className="px-6 py-4">
                           <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full border border-blue-100 shadow-sm">
                              {intern.role}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                           <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
                              <Mail className="w-4 h-4" />
                           </button>
                           <button onClick={() => handleDelete(intern.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </td>
                     </tr>
                   ))
                 ) : (
                   <tr>
                      <td colSpan={4} className="p-20 text-center">
                         <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-gray-200">
                            <Activity className="w-8 h-8 text-gray-300" />
                         </div>
                         <p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">No active intern protocols found.</p>
                      </td>
                   </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>

      {/* Add Intern Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight uppercase tracking-tighter">Add New Intern</h2>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Provision system access</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleAddIntern} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                <input 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Johnson" 
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Email Address</label>
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.com" 
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-2 text-indigo-100/5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                   <Key className="w-3 h-3" /> Create Account Password
                </label>
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a secure password" 
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg shadow-gray-900/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Intern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

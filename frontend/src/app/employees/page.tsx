"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, Search, MoreVertical, Mail, Trash2, ShieldCheck, Briefcase, X, Check, Loader2, Key, Star } from "lucide-react";
import { API_BASE_URL } from '@/config';
import { cn } from "@/lib/utils";
import PageGuide from '@/components/PageGuide';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Employee");

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error("Failed to fetch employees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });
      if (res.ok) {
        setShowAddModal(false);
        fetchEmployees();
        setName("");
        setEmail("");
        setPassword("");
        setRole("Employee");
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to create team member");
      }
    } catch (error) {
      console.error("Failed to add employee:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to remove this employee account?")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchEmployees();
    } catch (error) {
      console.error("Failed to delete employee:", error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase tracking-tighter">Core Team</h1>
          <p className="text-gray-500 font-medium font-poppins">Manage administrators and project managers.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-black shadow-xl shadow-gray-900/20 transition-all active:scale-95"
        >
          <UserPlus className="w-4 h-4" /> Add Team Member
        </button>
      </div>

      <PageGuide
        pageKey="employees"
        title="How the Core Team page works"
        description="This is where you manage all administrators and project managers who operate the CRM."
        steps={[
          { icon: '👤', text: 'Click \"Add Team Member\" to create a new admin or project manager account with login credentials.' },
          { icon: '🔑', text: 'Each team member gets a role (Admin or PM) that controls what they can access in the system.' },
          { icon: '✏️', text: 'Use the action menu on each row to reset passwords, change roles, or remove a member.' },
          { icon: '📧', text: 'Team members will use their email and password to log into the CRM dashboard.' },
        ]}
      />

      <div className="bg-white rounded-[3rem] border shadow-sm overflow-hidden text-gray-800">
        <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center bg-gray-50/50 gap-4">
           <div className="relative w-full md:w-72">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search team..." className="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm" />
           </div>
           <div className="flex gap-2">
              <span className="flex items-center gap-2 px-6 py-2 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase rounded-full border border-indigo-100 shadow-sm">
                 <ShieldCheck className="w-4 h-4" /> System Control Active
              </span>
           </div>
        </div>
        
        <div className="p-4 overflow-x-auto">
           <table className="w-full min-w-[600px]">
              <thead>
                 <tr className="text-left">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Team Identity</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Digital ID</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Privileges</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Vault Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {loading ? (
                   [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={4} className="h-20 px-6"></td></tr>)
                 ) : employees.length > 0 ? (
                   employees.map((member: any) => (
                     <tr key={member.id} className="hover:bg-gray-50 transition-all duration-300 group">
                        <td className="px-6 py-6">
                           <div className="flex items-center gap-4">
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm border-2 shadow-sm transition-transform group-hover:scale-110",
                                member.role === 'Admin' ? "bg-red-50 border-red-100 text-red-600" : "bg-indigo-50 border-indigo-100 text-indigo-600"
                              )}>
                                 {member.name?.charAt(0) || 'U'}
                                 {member.role === 'Admin' && <Star className="w-3 h-3 absolute -top-1 -right-1 fill-amber-400 text-amber-500" />}
                              </div>
                              <div>
                                 <p className="font-black text-gray-900 uppercase tracking-tight text-sm">{member.name}</p>
                                 <p className="text-[10px] text-gray-300 font-black uppercase tracking-widest">Member Since {new Date().getFullYear()}</p>
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           <div className="flex items-center gap-2">
                             <Mail className="w-3 h-3 text-gray-300" />
                             <p className="text-sm font-black text-gray-400 italic font-poppins">{member.email}</p>
                           </div>
                        </td>
                        <td className="px-6 py-6">
                           <span className={cn(
                             "px-4 py-1.5 text-[10px] font-black uppercase rounded-full border shadow-sm flex items-center gap-2 w-fit",
                             member.role === 'Admin' ? "bg-red-50 text-red-600 border-red-100" : "bg-green-50 text-green-600 border-green-100"
                           )}>
                              {member.role === 'Admin' ? <ShieldCheck className="w-3 h-3" /> : <Briefcase className="w-3 h-3" />}
                              {member.role}
                           </span>
                        </td>
                        <td className="px-6 py-6 text-right flex justify-end gap-2 pr-10">
                           <button className="p-3 text-gray-300 hover:text-indigo-600 hover:bg-white hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-indigo-100">
                              <Mail className="w-5 h-5" />
                           </button>
                           <button onClick={() => handleDelete(member.id)} className="p-3 text-gray-300 hover:text-red-600 hover:bg-white hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-red-100">
                              <Trash2 className="w-5 h-5" />
                           </button>
                        </td>
                     </tr>
                   ))
                 ) : (
                   <tr>
                      <td colSpan={4} className="p-20 text-center">
                         <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-gray-100">
                            <Users className="w-10 h-10 text-gray-200" />
                         </div>
                         <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Awaiting team mobilization...</p>
                      </td>
                   </tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Team Onboarding</h2>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Configure security credentials</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-4 hover:bg-white border rounded-[1.5rem] transition-all shadow-sm">
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleAddEmployee} className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Member Name</label>
                  <input 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Official Name" 
                    className="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-inner"
                  />
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 text-gray-800">Assign Privilege</label>
                   <select 
                     value={role}
                     onChange={(e) => setRole(e.target.value)}
                     className="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none shadow-inner"
                   >
                     <option>Employee</option>
                     <option>Admin</option>
                   </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Digital Identity (Email)</label>
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="corporate.id@crm.com" 
                  className="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-inner"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                   <Key className="w-3 h-3 text-indigo-500" /> Create Member Password
                </label>
                <input 
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Set initial access password" 
                  className="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] text-sm font-black focus:ring-2 focus:ring-indigo-500 transition-all outline-none shadow-inner"
                />
              </div>

              <div className="pt-8 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-8 py-5 bg-gray-100 text-gray-500 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-8 py-5 bg-gray-900 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-black shadow-2xl shadow-gray-900/30 transition-all flex items-center justify-center gap-3 active:scale-95"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5 text-green-400" />}
                  Deploy Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

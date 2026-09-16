"use client";

import { useState, useEffect } from "react";
import { 
  StickyNote, Users, Check, Loader2, ArrowLeft, 
  MessageSquare, Plus, Clock, UserPlus, Trash2, 
  ChevronRight, Activity, Target, Shield, Briefcase, X
} from "lucide-react";
import { API_BASE_URL } from '@/config';
import { cn } from "@/lib/utils";
import PageGuide from '@/components/PageGuide';
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useRole();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Update state
  const [isUpdating, setIsUpdating] = useState(false);
  const [comment, setComment] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);
  
  // Dropdown states
  const [allEmployees, setAllEmployees] = useState([]);
  const [allInterns, setAllInterns] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects/${id}`);
      const projectData = await res.json();
      setData(projectData);
      
      // Fetch users for assignment
      const [empRes, intRes] = await Promise.all([
        fetch(`${API_BASE_URL}/employees`),
        fetch(`${API_BASE_URL}/interns`)
      ]);
      const empData = await empRes.json();
      const intData = await intRes.json();
      setAllEmployees(empData.employees || []);
      setAllInterns(intData.interns || []);
    } catch (error) {
      console.error("Failed to fetch project details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const updateProgress = async (val: number) => {
    setIsUpdating(true);
    try {
      await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: val })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update progress:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    try {
      await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setIsAddingComment(true);
    try {
      await fetch(`${API_BASE_URL}/projects/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: comment,
          author_id: user?.id,
          isInternal: true
        })
      });
      setComment("");
      fetchData();
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsAddingComment(false);
    }
  };

  const assignTeamMember = async (userId: number, role: 'Employee' | 'Intern') => {
    const project = data.project;
    const field = role === 'Employee' ? 'employeeIds' : 'internIds';
    const currentIds = project[field] || [];
    
    if (currentIds.includes(userId)) return;
    
    setIsUpdating(true);
    try {
      await fetch(`${API_BASE_URL}/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: [...currentIds, userId] })
      });
      fetchData();
    } catch (error) {
      console.error("Failed to assign member:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Constructing Dashboard...</p>
    </div>
  );

  if (!data?.project) return (
    <div className="text-center p-20">
      <p className="text-xl font-bold text-gray-900">Project Not Found</p>
      <Link href="/projects" className="text-blue-600 hover:underline mt-4 inline-block font-medium">Return to Projects</Link>
    </div>
  );

  const { project, remarks, team } = data;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => router.back()}
            className="p-4 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-gray-900 shadow-sm transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
               <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase tracking-tighter">{project.name}</h1>
               <span className={cn(
                 "px-4 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm",
                 project.status === 'Planning' ? "bg-amber-50 text-amber-600 border-amber-100" :
                 project.status === 'Active' ? "bg-blue-50 text-blue-600 border-blue-100" :
                 "bg-green-50 text-green-600 border-green-100"
               )}>
                 {project.status}
               </span>
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
              <Shield className="w-3 h-3" /> Project ID: {project.id} • Created {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border shadow-sm self-stretch md:self-auto">
           {['Planning', 'Active', 'Completed'].map((s) => (
             <button
               key={s}
               onClick={() => updateStatus(s)}
               disabled={isUpdating}
               className={cn(
                 "flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all",
                 project.status === s 
                  ? "bg-gray-900 text-white shadow-md shadow-gray-900/20" 
                  : "text-gray-400 hover:bg-gray-50"
               )}
             >
               {s}
             </button>
           ))}
        </div>
      </div>

      <PageGuide
        pageKey="project-detail"
        title="How the Project Detail page works"
        description="Everything about this project in one place — team, progress, comments, and activity."
        steps={[
          { icon: '📍', text: 'The header shows the project name, status badge, and creation date.' },
          { icon: '👥', text: 'Assign team members (employees and interns) from the dropdowns to manage who works on this.' },
          { icon: '💬', text: 'Add comments to discuss progress, share updates, or leave notes for the team.' },
          { icon: '📊', text: 'Update project status (Planning, Active, Completed) using the buttons and track progress percentage.' },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Progress & Description */}
        <div className="lg:col-span-2 space-y-8 font-poppins text-gray-800">
           {/* Progress Card */}
           <div className="bg-white p-8 md:p-10 rounded-[3rem] border shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 transition-transform">
                 <Activity className="w-32 h-32" />
              </div>
              
              <div className="flex justify-between items-end mb-8">
                 <div>
                    <h2 className="text-xl font-black text-gray-900 mb-1">REAL-TIME PROGRESS</h2>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Update project milestone completion</p>
                 </div>
                 <div className="text-4xl font-black text-blue-600">{project.progress}%</div>
              </div>
              
              <input 
                type="range"
                min="0"
                max="100"
                value={project.progress}
                onChange={(e) => updateProgress(Number(e.target.value))}
                className="w-full h-4 bg-gray-100 rounded-full appearance-none cursor-pointer accent-blue-600 mb-4"
              />
              
              <div className="flex justify-between text-[10px] font-black text-gray-300 uppercase tracking-widest">
                 <span>Initiation</span>
                 <span>Midway</span>
                 <span>Final Delivery</span>
              </div>
           </div>

           {/* Description Card */}
           <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                <Target className="w-4 h-4 text-blue-600" /> Project Objective & Scope
              </h2>
              <div className="prose prose-blue max-w-none text-gray-600 leading-relaxed font-medium">
                 {project.description || "The project manager has not provided a detailed description yet."}
              </div>
              
              <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-gray-800">Assignees</p>
                    <p className="text-xl font-black text-gray-900">{(project.employeeIds?.length || 0) + (project.internIds?.length || 0)}</p>
                 </div>
                 <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-gray-800">Total Milestones</p>
                    <p className="text-xl font-black text-gray-900">8</p>
                 </div>
                 <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-gray-800">Active Tasks</p>
                    <p className="text-xl font-black text-gray-900">3</p>
                 </div>
                 <div className="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 text-center">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 text-gray-800">Health</p>
                    <p className="text-xl font-black text-green-600">GOOD</p>
                 </div>
              </div>
           </div>

           {/* Comments Section */}
           <div className="bg-white p-10 rounded-[3rem] border shadow-sm">
              <div className="flex justify-between items-center mb-8">
                 <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                   <MessageSquare className="w-4 h-4 text-blue-600" /> Project Remarks & Internal Notes
                 </h2>
                 <span className="text-[10px] font-black text-gray-300 uppercase">{remarks?.length || 0} TOTAL</span>
              </div>
              
              <form onSubmit={handleAddComment} className="mb-10 relative">
                 <textarea 
                   value={comment}
                   onChange={(e) => setComment(e.target.value)}
                   placeholder="Post an internal update or concern..."
                   className="w-full p-6 bg-gray-50 border-none rounded-[2rem] text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none min-h-[120px]"
                 />
                 <button 
                  type="submit"
                  disabled={isAddingComment || !comment.trim()}
                  className="absolute bottom-4 right-4 p-4 bg-gray-900 text-white rounded-2xl hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
                 >
                   {isAddingComment ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                 </button>
              </form>
              
              <div className="space-y-6">
                 {remarks && remarks.length > 0 ? (
                   remarks.map((r: any) => (
                     <div key={r.id} className="flex gap-4 group">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex-shrink-0 flex items-center justify-center font-black text-blue-600 text-xs border border-blue-100">
                           {r.authorId || 'A'}
                        </div>
                        <div className="flex-1">
                           <div className="bg-gray-50 p-6 rounded-[2rem] rounded-tl-none border border-gray-100 group-hover:border-blue-100 transition-all">
                              <p className="text-sm font-medium text-gray-700 leading-relaxed">{r.content}</p>
                           </div>
                           <div className="flex items-center gap-4 mt-2 ml-2">
                              <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{new Date(r.createdAt).toLocaleString()}</span>
                              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest italic">• INTERNAL</span>
                           </div>
                        </div>
                     </div>
                   ))
                 ) : (
                   <div className="text-center py-10 opacity-30">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">No conversation logs found</p>
                   </div>
                 )}
              </div>
           </div>
        </div>

        {/* Right Column: Team Management */}
        <div className="space-y-8 font-poppins">
           {/* Team Card */}
           <div className="bg-white p-8 rounded-[3.5rem] border shadow-sm">
              <div className="flex justify-between items-center mb-10">
                 <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-3">
                   <Users className="w-4 h-4 text-blue-600" /> Core Team Assigned
                 </h2>
                 <button 
                   onClick={() => setShowAssignModal(true)}
                   className="p-3 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all shadow-sm border border-gray-100"
                 >
                    <UserPlus className="w-5 h-5" />
                 </button>
              </div>

              <div className="space-y-8">
                 {/* Employees */}
                 <div>
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Briefcase className="w-3 h-3" /> Senior Members ({(team?.employees?.length || 0)})
                    </h3>
                    <div className="space-y-3">
                       {team?.employees?.map((e: any) => (
                          <div key={e.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-3xl border border-gray-100 group hover:border-blue-100 transition-all">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-2xl border shadow-sm flex items-center justify-center font-black text-gray-900">
                                   {e.name.charAt(0)}
                                </div>
                                <div className="leading-tight">
                                   <p className="text-sm font-black text-gray-900">{e.name}</p>
                                   <p className="text-[10px] font-bold text-gray-400 italic">Project Manager</p>
                                </div>
                             </div>
                             <button className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>

                 {/* Interns */}
                 <div>
                    <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                       <Activity className="w-3 h-3" /> Supporting Interns ({(team?.interns?.length || 0)})
                    </h3>
                    <div className="space-y-3">
                       {team?.interns?.map((i: any) => (
                          <div key={i.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-3xl border border-gray-100 group hover:border-blue-100 transition-all">
                             <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-2xl border shadow-sm flex items-center justify-center font-black text-blue-600">
                                   {i.name.charAt(0)}
                                </div>
                                <div className="leading-tight">
                                   <p className="text-sm font-black text-gray-900">{i.name}</p>
                                   <p className="text-[10px] font-bold text-gray-400 tracking-tighter italic">{i.email}</p>
                                </div>
                             </div>
                             <button className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                             </button>
                          </div>
                       ))}
                    </div>
                 </div>
                 
                 {(team?.employees?.length === 0 && team?.interns?.length === 0) && (
                   <div className="text-center py-10 px-6 border-2 border-dashed border-gray-100 rounded-[2.5rem]">
                      <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-4">Unassigned Initiative</p>
                      <button 
                        onClick={() => setShowAssignModal(true)}
                        className="text-xs font-black text-blue-600 hover:text-blue-700 transition-colors uppercase"
                      >
                         + Build Your Team
                      </button>
                   </div>
                 )}
              </div>
           </div>

           {/* Metrics Card */}
           <div className="bg-gray-900 p-10 rounded-[3.5rem] shadow-2xl shadow-gray-900/30 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                 <Shield className="w-20 h-20" />
              </div>
              <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-8">Initiative Health</h2>
              
              <div className="space-y-6">
                 <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                       <span>Velocity</span>
                       <span className="text-green-400">OPTIMAL</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full">
                       <div className="bg-green-400 h-full w-[85%] rounded-full shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
                    </div>
                 </div>
                 <div>
                    <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                       <span>Risk Level</span>
                       <span className="text-blue-400">MINIMAL</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full">
                       <div className="bg-blue-400 h-full w-[25%] rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)]"></div>
                    </div>
                 </div>
              </div>
              
              <div className="mt-10 pt-10 border-t border-white/10 flex items-center justify-between">
                 <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Efficiency</div>
                 <div className="text-2xl font-black italic">A+</div>
              </div>
           </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-blue-600" /> Assign Team
                </h2>
                <button onClick={() => setShowAssignModal(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-8">
                 <div>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Available Employees</h3>
                    <div className="space-y-2">
                       {allEmployees.map((emp: any) => (
                          <button 
                            key={emp.id}
                            disabled={project.employeeIds?.includes(emp.id)}
                            onClick={() => assignTeamMember(emp.id, 'Employee')}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                              project.employeeIds?.includes(emp.id) 
                                ? "bg-blue-50 border-blue-100 opacity-60" 
                                : "hover:border-blue-300 hover:bg-gray-50 border-gray-100"
                            )}
                          >
                             <span className="text-sm font-bold text-gray-900">{emp.name}</span>
                             {project.employeeIds?.includes(emp.id) ? <Check className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
                          </button>
                       ))}
                    </div>
                 </div>

                 <div>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Available Interns</h3>
                    <div className="space-y-2">
                       {allInterns.map((int: any) => (
                          <button 
                            key={int.id}
                            disabled={project.internIds?.includes(int.id)}
                            onClick={() => assignTeamMember(int.id, 'Intern')}
                            className={cn(
                              "w-full flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                              project.internIds?.includes(int.id) 
                                ? "bg-blue-50 border-blue-100 opacity-60" 
                                : "hover:border-blue-300 hover:bg-gray-50 border-gray-100"
                            )}
                          >
                             <span className="text-sm font-bold text-gray-900">{int.name}</span>
                             {project.internIds?.includes(int.id) ? <Check className="w-4 h-4 text-blue-600" /> : <ChevronRight className="w-4 h-4 text-gray-300" />}
                          </button>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { StickyNote, Users, Plus, Search, MoreVertical, X, Check, Loader2 } from "lucide-react";
import { API_BASE_URL } from '@/config';
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Planning");
  const [progress, setProgress] = useState(0);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/projects`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, status, progress })
      });
      if (res.ok) {
        setShowCreateModal(false);
        fetchProjects();
        // Reset form
        setName("");
        setDescription("");
        setStatus("Planning");
        setProgress(0);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Project Dashboard</h1>
          <p className="text-gray-500 font-medium">Create, track, and manage all your team initiatives.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg shadow-gray-900/20 transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" /> New Project
        </button>
      </div>

      <PageGuide
        pageKey="projects"
        title="How the Project Dashboard works"
        description="Create, organize, and track team initiatives from start to finish."
        steps={[
          { icon: '📁', text: 'Click \"New Project\" to create an initiative with a name, description, and status.' },
          { icon: '👥', text: 'Click any project card to assign team members, set progress, and manage details.' },
          { icon: '📊', text: 'Each project card shows its current status (Planning, Active, Completed) and progress.' },
          { icon: '💬', text: 'Inside each project you can add comments, track activity, and monitor timelines.' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-[2.5rem]"></div>)
        ) : projects.length > 0 ? (
          projects.map((project: any) => (
            <Link 
              href={`/projects/${project.id}`} 
              key={project.id} 
              className="bg-white p-8 rounded-[2.5rem] border shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6">
                <div className={cn(
                  "p-4 rounded-2xl",
                  project.status === 'Planning' ? "bg-amber-50 text-amber-600" :
                  project.status === 'Active' ? "bg-blue-50 text-blue-600" :
                  project.status === 'Completed' ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-600"
                )}>
                  <StickyNote className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end">
                   <span className={cn(
                     "px-3 py-1 text-[10px] font-black uppercase rounded-full border mb-1",
                     project.status === 'Planning' ? "bg-amber-50 text-amber-600 border-amber-100" :
                     project.status === 'Active' ? "bg-blue-50 text-blue-600 border-blue-100" :
                     project.status === 'Completed' ? "bg-green-50 text-green-600 border-green-100" : "bg-gray-50 text-gray-400 border-gray-100"
                   )}>
                     {project.status}
                   </span>
                   <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest leading-none">Status</p>
                </div>
              </div>
              
              <h3 className="text-xl font-black text-gray-900 mb-2 truncate group-hover:text-blue-600 transition-colors uppercase tracking-tight">{project.name}</h3>
              <p className="text-sm text-gray-400 font-medium mb-6 line-clamp-2 min-h-[2.5rem]">
                {project.description || "No project description provided."}
              </p>

              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Progress</p>
                  <p className="text-sm font-black text-gray-900">{project.progress}%</p>
                </div>
                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      project.progress > 80 ? "bg-green-500" : project.progress > 40 ? "bg-blue-500" : "bg-amber-500"
                    )}
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-50 flex justify-between items-center">
                 <div className="flex -space-x-2">
                    {[1, 2].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-gray-400">
                        {i}
                      </div>
                    ))}
                    <div className="w-8 h-8 rounded-full bg-blue-50 border-2 border-white flex items-center justify-center text-[10px] font-black text-blue-600">
                      +0
                    </div>
                 </div>
                 <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Team Assigned</p>
              </div>
            </Link>
          ))
        ) : (
          <div className="col-span-full p-20 text-center bg-gray-50 rounded-[3rem] border-2 border-dashed border-gray-200">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border">
               <StickyNote className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-xl font-black text-gray-900 mb-2">No Projects Found</p>
            <p className="text-gray-500 font-medium max-w-xs mx-auto mb-8">Ready to start something new? Create your first comprehensive project dashboard.</p>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-3 bg-white border-2 border-gray-900 text-gray-900 rounded-2xl font-bold text-sm hover:bg-gray-900 hover:text-white transition-all shadow-sm"
            >
               Create New Project
            </button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Create Project</h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Setup new team initiative</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Project Title</label>
                <input 
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Q1 SEO Optimization" 
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Project Objective</label>
                <textarea 
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the main goals and scope of this project..." 
                  className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Initial Status</label>
                  <select 
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none appearance-none"
                  >
                    <option>Planning</option>
                    <option>Active</option>
                    <option>Hold</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Progress (%)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100"
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-6 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-4 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg shadow-gray-900/20 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

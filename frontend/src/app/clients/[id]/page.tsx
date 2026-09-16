"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Globe, 
  User, 
  MapPin, 
  ShieldCheck, 
  Hash, 
  MessageSquare, 
  Activity, 
  Plus, 
  Send,
  Loader2,
  Trash2,
  CheckCircle,
  Clock,
  Briefcase,
  Users,
  Edit2,
  Save,
  X,
  TrendingUp,
  Zap,
  ChevronRight,
  Mail,
  FolderKanban,
  Target,
  Eye
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import { cn } from '@/lib/utils';
import PageGuide from '@/components/PageGuide';
import axios from 'axios';
import { DollarSign, XCircle } from 'lucide-react';

// Framer Motion Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } }
};

const CommentSkeleton = () => (
  <div className="p-5 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-sm animate-pulse">
    <div className="flex justify-between mb-4">
      <div className="h-4 w-24 bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-32 bg-slate-300/50 rounded-full"></div>
    </div>
    <div className="space-y-3">
      <div className="h-4 w-full bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-2/3 bg-slate-300/50 rounded-full"></div>
    </div>
  </div>
);

const ActivitySkeletonTab = () => (
  <div className="flex gap-4 p-5 bg-white/40 backdrop-blur-md border border-white/60 shadow-sm rounded-2xl animate-pulse relative overflow-hidden">
    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-300/50"></div>
    <div className="bg-indigo-100/50 p-3 rounded-xl h-12 w-12 flex-shrink-0"></div>
    <div className="flex-1 space-y-3 py-1">
      <div className="h-5 w-48 bg-slate-300/50 rounded-full"></div>
      <div className="h-4 w-full bg-slate-300/50 rounded-full"></div>
      <div className="h-3 w-24 bg-slate-300/50 rounded-full mt-3"></div>
    </div>
  </div>
);

// Payment Status Widget
const paymentStatusColors = {
  Paid: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    label: 'Paid'
  },
  Pending: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: <Clock className="w-5 h-5 text-amber-500" />,
    label: 'Pending'
  },
  Failed: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: <XCircle className="w-5 h-5 text-red-500" />,
    label: 'Failed'
  }
};

function PaymentStatusWidget({ status }: { status: string }) {
  const validStatus = (status as keyof typeof paymentStatusColors) in paymentStatusColors 
    ? status as keyof typeof paymentStatusColors 
    : 'Pending';
  const config = paymentStatusColors[validStatus];
  return (
    <div className={`flex items-center gap-4 p-6 rounded-2xl border border-white/60 shadow-sm ${config.bg}`}> 
      <div className="bg-white p-3 rounded-xl shadow-sm">{config.icon}</div>
      <div>
        <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Payment Status</div>
        <div className={`text-lg font-bold ${config.text}`}>{config.label}</div>
      </div>
    </div>
  );
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [client, setClient] = useState<any>(null);
  const [remarks, setRemarks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const { role } = useRole();
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [milestoneData, setMilestoneData] = useState({
    nextMilestone: '',
    nextMilestoneDate: ''
  });
  const [isEditingServices, setIsEditingServices] = useState(false);
  const [editServicesForm, setEditServicesForm] = useState({
    services_offered: '',
    services_requested: ''
  });
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [isEditingMetrics, setIsEditingMetrics] = useState(false);
  const [metricsForm, setMetricsForm] = useState<Record<string, string>>({
    total_revenue: '', growth_rate: '',
    monthly_revenue: '', revenue_growth_pct: '',
    total_conversions: '', avg_conversion_value: '',
    roi_multiple: '', roi_detail: '',
    campaign_progress: '', campaign_phase_note: '',
    untapped_revenue_note: '',
    total_visitors: '', engagement_rate: '', avg_time_on_site: '',
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ companyName: '', projectName: '', websiteUrl: '' });
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      companyName: profileForm.companyName,
      projectName: profileForm.projectName,
      websiteUrl: profileForm.websiteUrl
    });
    setIsEditingProfile(false);
  };

  useEffect(() => {
    if (id) {
      Promise.all([
        fetchClientData(),
        fetchRemarks(),
        fetchActivities(),
        fetchEmails(),
        fetchEmployees(),
        fetchStatuses(),
        fetchServiceRequests(),
        fetchTimeline(),
      ]).finally(() => setPageLoading(false));
    }
  }, [id]);

  const fetchStatuses = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/client-statuses`);
      const data = await res.json();
      setStatuses(data.statuses || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/employees`);
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchClientData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data);
        const cf = data.customFields || {};
        setMetricsForm({
          total_revenue: cf.total_revenue || '',
          growth_rate: cf.growth_rate || '',
          monthly_revenue: cf.monthly_revenue || '',
          revenue_growth_pct: cf.revenue_growth_pct || '',
          total_conversions: cf.total_conversions || '',
          avg_conversion_value: cf.avg_conversion_value || '',
          roi_multiple: cf.roi_multiple || '',
          roi_detail: cf.roi_detail || '',
          campaign_progress: cf.campaign_progress || '',
          campaign_phase_note: cf.campaign_phase_note || '',
          untapped_revenue_note: cf.untapped_revenue_note || '',
          total_visitors: cf.total_visitors || '',
          engagement_rate: cf.engagement_rate || '',
          avg_time_on_site: cf.avg_time_on_site || '',
        });
        setEditServicesForm({
          services_offered: data.services_offered || '',
          services_requested: data.services_requested || ''
        });
        setMilestoneData({
          nextMilestone: data.nextMilestone || '',
          nextMilestoneDate: data.nextMilestoneDate || ''
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRemarks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/remarks`);
      if (res.ok) {
        const data = await res.json();
        setRemarks(data.remarks || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/activities`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmails = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/emails`);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchServiceRequests = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/services/requests`);
      if (res.ok) {
        const data = await res.json();
        setServiceRequests((data.requests || []).filter((r: any) => r.client_id === Number(id)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTimeline = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/timeline`);
      if (res.ok) {
        const data = await res.json();
        setTimeline(data.timeline || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignEmployee = async (employeeId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/assign-employee`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId })
      });
      if (res.ok) {
        setIsAssignModalOpen(false);
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/clients/${id}/keywords`, { keyword: newKeyword });
      if (res.data.success) {
        setNewKeyword('');
        setIsKeywordModalOpen(false);
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add keyword");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveKeyword = async (keyword: string) => {
    if (!confirm(`Remove keyword "${keyword}"?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      });
      if (res.ok) {
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value;
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}/remarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, createdBy: 'Admin' })
      });
      if (res.ok) {
        fetchRemarks();
        form.reset();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = {
      method: formData.get('method') as string,
      content: formData.get('content') as string
    };
    try {
      const res = await axios.post(`${API_BASE_URL}/clients/${id}/activities`, data);
      if (res.data.success) {
        fetchActivities();
        setIsActivityModalOpen(false);
        form.reset();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to add activity");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        fetchClientData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveMetrics = async () => {
    setLoading(true);
    try {
      await updateProfile({ customFields: metricsForm });
      setIsEditingMetrics(false);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(milestoneData);
      setIsMilestoneModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 animate-pulse mt-4">Pulling Intelligence Data...</h2>
      </div>
    );
  }
  if (!client) return <div className="p-8 text-red-500 font-bold text-center">Neural link failed. Client not found.</div>;

  // --- INTERACTIVE STORYTELLING DASHBOARD ---
  return (
    <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* EPIC WELCOME HERO */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative mb-16 overflow-hidden rounded-3xl"
        >
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-90"></div>
          <motion.div 
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
            className="absolute top-0 right-0 w-96 h-96 bg-white/20 rounded-full blur-3xl"
          ></motion.div>
          <motion.div 
            animate={{ scale: [1, 0.9, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, delay: 1 }}
            className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl"
          ></motion.div>

          {/* Content */}
          <div className="relative z-10 p-12 text-white">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <p className="text-cyan-200 font-bold text-sm uppercase tracking-widest mb-3">Welcome Back To Your Growth Hub</p>
              <h1 className="text-6xl md:text-7xl font-black mb-4 leading-tight">
                {client.companyName}
              </h1>
              <p className="text-xl text-white/90 font-medium max-w-2xl">
                Your intelligent growth partner is ready to scale your business to new heights. Let's unlock extraordinary results together.
              </p>
            </motion.div>

            {/* Stats Preview */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="grid grid-cols-3 gap-6 mt-8"
            >
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <p className="text-white/70 text-sm font-bold uppercase tracking-wider mb-2">Active Services</p>
                <p className="text-3xl font-black text-cyan-200">{serviceRequests.filter(r => r.status !== 'Pending').length || 0}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <p className="text-white/70 text-sm font-bold uppercase tracking-wider mb-2">Total Revenue</p>
                <p className="text-3xl font-black text-cyan-200">{client.customFields?.total_revenue || '—'}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
                <p className="text-white/70 text-sm font-bold uppercase tracking-wider mb-2">Growth Rate</p>
                <p className="text-3xl font-black text-cyan-200">{client.customFields?.growth_rate || '—'}</p>
              </div>
            </motion.div>
          </div>
        </motion.div>


        {/* STORYTELLING SECTION: Your Performance Journey */}
        <PageGuide
          pageKey="client-detail"
          title="Understanding Your Client Dashboard"
          description="This is the complete profile page for this client — a 360° view of their business, services, and performance."
          steps={[
            { icon: '📊', text: 'Performance Story section shows growth metrics like traffic, revenue, and rankings over time.' },
            { icon: '💼', text: 'Scroll down to see active services, recent activity, communications, and project timeline.' },
            { icon: '✏️', text: 'Admins can click \"Edit Metrics\" to update this client\'s financial and performance data.' },
            { icon: '💬', text: 'The comments section lets you add internal notes and track all communication history.' },
          ]}
        />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wider">Your Performance Story</h2>
            {(role === 'Admin' || role === 'Employee') && (
              <button onClick={() => setIsEditingMetrics(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg transition-all">
                <Edit2 size={12} /> Edit Metrics
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1: Growth Momentum */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className="bg-white border border-slate-200 rounded-3xl p-8 group overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-green-400/20 to-emerald-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-green-100 text-green-600 rounded-xl"><TrendingUp size={24} /></div>
                  <h3 className="text-xl font-black text-slate-800">Growth Momentum</h3>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-bold mb-2">This Month's Revenue</p>
                  <p className="text-4xl font-black text-green-600">{client.customFields?.monthly_revenue || '—'}</p>
                  <p className="text-sm text-green-700 mt-2 font-bold">{client.customFields?.revenue_growth_pct || 'No data yet'}</p>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Conversion Power */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className="bg-white border border-slate-200 rounded-3xl p-8 group overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Zap size={24} /></div>
                  <h3 className="text-xl font-black text-slate-800">Conversion Power</h3>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-bold mb-2">Total Conversions</p>
                  <p className="text-4xl font-black text-blue-600">{client.customFields?.total_conversions || '—'}</p>
                  <p className="text-sm text-blue-700 mt-2 font-bold">{client.customFields?.avg_conversion_value || 'No data yet'}</p>
                </div>
              </div>
            </motion.div>

            {/* Card 3: ROI Victory */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.1, duration: 0.6 }}
              whileHover={{ y: -8 }}
              className="bg-white border border-slate-200 rounded-3xl p-8 group overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-500"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-xl"><DollarSign size={24} /></div>
                  <h3 className="text-xl font-black text-slate-800">ROI Victory</h3>
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-bold mb-2">Return on Investment</p>
                  <p className="text-4xl font-black text-purple-600">{client.customFields?.roi_multiple || '—'}</p>
                  <p className="text-sm text-purple-700 mt-2 font-bold">{client.customFields?.roi_detail || 'No data yet'}</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* PARTNERSHIP PROFILE HERO */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wider">Your Partnership</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Profile Card - Modern Design */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="group relative bg-white border border-slate-200 rounded-3xl p-10 overflow-hidden shadow-sm"
            >
              {/* Animated glow */}
              <motion.div
                className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.5 }}
              ></motion.div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg"
                  >
                    <Briefcase size={32} className="text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Company Profile</h3>
                    <p className="text-sm text-slate-500 font-bold">Your business details</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Editable Company Profile Fields */}
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <motion.div className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block">Company Name</label>
                        <input className="w-full px-3 py-2 rounded-xl border border-cyan-200 font-black text-cyan-700 bg-white" value={profileForm.companyName} onChange={e => setProfileForm({ ...profileForm, companyName: e.target.value })} />
                      </motion.div>
                      <motion.div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block">Project Name</label>
                        <input className="w-full px-3 py-2 rounded-xl border border-blue-200 font-black text-blue-700 bg-white" value={profileForm.projectName} onChange={e => setProfileForm({ ...profileForm, projectName: e.target.value })} />
                      </motion.div>
                      <motion.div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 block">Website</label>
                        <input className="w-full px-3 py-2 rounded-xl border border-purple-200 font-black text-purple-700 bg-white" value={profileForm.websiteUrl} onChange={e => setProfileForm({ ...profileForm, websiteUrl: e.target.value })} />
                      </motion.div>
                      <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setIsEditingProfile(false)} className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold">Cancel</button>
                        <button type="submit" className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-bold">Save</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.4 }} className="p-4 bg-cyan-50 border border-cyan-200 rounded-2xl hover:bg-cyan-100 transition-all flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Company Name</p>
                          <p className="text-xl font-black text-cyan-700">{client.companyName}</p>
                        </div>
                        <button onClick={() => { setIsEditingProfile(true); setProfileForm({ companyName: client.companyName || '', projectName: client.projectName || '', websiteUrl: client.website || client.websiteUrl || '' }); }} className="ml-4 p-2 rounded-full bg-cyan-100 hover:bg-cyan-200"><Edit2 className="w-4 h-4 text-cyan-700" /></button>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.45 }} className="p-4 bg-blue-50 border border-blue-200 rounded-2xl hover:bg-blue-100 transition-all flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Project Name</p>
                          <p className="text-xl font-black text-blue-700">{client.projectName || 'Active Project'}</p>
                        </div>
                        <button onClick={() => { setIsEditingProfile(true); setProfileForm({ companyName: client.companyName || '', projectName: client.projectName || '', websiteUrl: client.website || client.websiteUrl || '' }); }} className="ml-4 p-2 rounded-full bg-blue-100 hover:bg-blue-200"><Edit2 className="w-4 h-4 text-blue-700" /></button>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.5 }} className="p-4 bg-purple-50 border border-purple-200 rounded-2xl hover:bg-purple-100 transition-all flex justify-between items-center">
                        <div>
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Website</p>
                          <p className="text-lg font-black text-purple-700 truncate">{client.website || client.websiteUrl || 'www.yourwebsite.com'}</p>
                        </div>
                        <button onClick={() => { setIsEditingProfile(true); setProfileForm({ companyName: client.companyName || '', projectName: client.projectName || '', websiteUrl: client.website || client.websiteUrl || '' }); }} className="ml-4 p-2 rounded-full bg-purple-100 hover:bg-purple-200"><Edit2 className="w-4 h-4 text-purple-700" /></button>
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Team & Services - Interactive */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.3, duration: 0.6 }}
              className="group relative bg-white border border-slate-200 rounded-3xl p-10 overflow-hidden shadow-sm"
            >
              {/* Animated glow */}
              <motion.div
                className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100"
                transition={{ duration: 0.5 }}
              ></motion.div>

              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-8">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: -5 }}
                    className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg"
                  >
                    <Users size={32} className="text-white" />
                  </motion.div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800">Active Services</h3>
                    <p className="text-sm text-slate-500 font-bold">What we're doing for you</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {serviceRequests.length === 0 ? (
                    <p className="text-sm text-slate-500 italic py-2">No active services yet.</p>
                  ) : (
                    serviceRequests.map((svc: any, idx: number) => (
                      <motion.div
                        key={svc.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.4 + idx * 0.05 }}
                        className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200 hover:bg-purple-100 transition-all"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                          className="w-3 h-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full shrink-0"
                        />
                        <span className="font-bold text-slate-800 flex-1">{svc.service_name}</span>
                        <span className="text-xs text-slate-500 font-medium">{svc.status}</span>
                        <CheckCircle size={14} className="text-green-400" />
                      </motion.div>
                    ))
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black rounded-xl shadow-lg hover:shadow-purple-500/30 transition-all"
                >
                  Connect With Your Team
                </motion.button>
              </div>
            </motion.div>
          </div>
        </motion.div>
        {/* ENGAGEMENT OPPORTUNITIES */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wider">Next Steps Forward</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strategy Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              whileHover={{ y: -8 }}
              className="group relative bg-white border border-slate-200 rounded-3xl p-8 overflow-hidden cursor-pointer shadow-sm"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">{client.nextMilestone || 'Next Campaign Phase'}</h3>
                    <p className="text-sm text-slate-500">{client.nextMilestoneDate || 'No deadline set'}</p>
                  </div>
                  <div className="p-3 bg-green-100 text-green-600 rounded-xl"><Zap size={24} /></div>
                </div>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Number(client.customFields?.campaign_progress) || 0)}%` }}
                  transition={{ delay: 1.6, duration: 0.8 }}
                  className="h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full mb-3"
                />
                <p className="text-sm font-bold text-slate-600">
                  {client.customFields?.campaign_phase_note || (client.nextMilestone ? `${client.customFields?.campaign_progress || 0}% Complete` : 'Not yet configured')}
                </p>
              </div>
            </motion.div>

            {/* Opportunity Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.55 }}
              whileHover={{ y: -8 }}
              className="group relative bg-white border border-slate-200 rounded-3xl p-8 overflow-hidden cursor-pointer shadow-sm"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Untapped Revenue</h3>
                    <p className="text-sm text-slate-500">Growth opportunities ahead</p>
                  </div>
                  <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><TrendingUp size={24} /></div>
                </div>
                <p className="text-lg font-bold text-slate-600 mb-4">
                  {client.customFields?.untapped_revenue_note || 'No data yet — admin can set this'}
                </p>
                <Link href="/store" className="block w-full py-2 text-center bg-orange-600/80 hover:bg-orange-600 text-white rounded-xl font-bold text-sm transition-all">
                  See Opportunities →
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* DETAILED INSIGHTS - Tabs with Content */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="mb-16"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wider">Detailed Insights</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Overview Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.7 }}
              whileHover={{ y: -8 }}
              className="group bg-white border border-slate-200 rounded-3xl p-8 overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Eye size={24} className="text-blue-600" />
                  Performance Overview
                </h3>
                <div className="space-y-3">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-xs text-slate-500 font-bold mb-1">Total Visitors</p>
                    <p className="text-2xl font-black text-blue-700">{client.customFields?.total_visitors || '—'}</p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-xs text-slate-500 font-bold mb-1">Engagement Rate</p>
                    <p className="text-2xl font-black text-blue-700">{client.customFields?.engagement_rate || '—'}</p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="text-xs text-slate-500 font-bold mb-1">Avg Time on Site</p>
                    <p className="text-2xl font-black text-blue-700">{client.customFields?.avg_time_on_site || '—'}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Recent Activity Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.75 }}
              whileHover={{ y: -8 }}
              className="group bg-white border border-slate-200 rounded-3xl p-8 overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Activity size={24} className="text-purple-600" />
                  Recent Activity
                </h3>
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-sm text-slate-500 italic">No activities recorded yet.</p>
                  ) : (
                    activities.slice(0, 3).map((item: any, idx: number) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.8 + idx * 0.05 }}
                        className="p-3 bg-purple-50 border border-purple-200 rounded-xl"
                      >
                        <p className="text-sm font-bold text-slate-800">{item.action || item.content}</p>
                        <p className="text-xs text-slate-500 font-medium">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}</p>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>

            {/* Team Connection Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8 }}
              whileHover={{ y: -8 }}
              className="group bg-white border border-slate-200 rounded-3xl p-8 overflow-hidden shadow-sm"
            >
              <div className="absolute top-0 left-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                  <Users size={24} className="text-pink-600" />
                  Your Team
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const assignedEmp = employees.find((e: any) => e.id === client.assignedEmployeeId);
                    return assignedEmp ? (
                      <div className="p-4 bg-pink-50 border border-pink-200 rounded-xl">
                        <p className="text-xs text-slate-500 font-bold mb-2">Account Manager</p>
                        <p className="text-sm font-black text-pink-700">{assignedEmp.name}</p>
                        <p className="text-xs text-slate-400 mt-1">{assignedEmp.email}</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-pink-50 border border-pink-200 rounded-xl">
                        <p className="text-xs text-slate-500 font-bold mb-2">Account Manager</p>
                        <p className="text-sm font-medium text-slate-400 italic">Not assigned yet</p>
                      </div>
                    );
                  })()}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-pink-500/30 transition-all"
                  >
                    Message Your Team
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* ─── UNIFIED ACTIVITY TIMELINE ─── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.9 }} className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-1 w-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"></div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-wider">Activity Timeline</h2>
          </div>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'all', label: 'All' },
              { key: 'email', label: 'Emails' },
              { key: 'call', label: 'Calls' },
              { key: 'invoice', label: 'Invoices' },
              { key: 'milestone', label: 'Milestones' },
              { key: 'file', label: 'Files' },
              { key: 'activity', label: 'Activities' },
            ].map(f => (
              <button key={f.key} onClick={() => setTimelineFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${timelineFilter === f.key ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {/* Timeline List */}
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-300 via-purple-300 to-transparent"></div>
            <div className="space-y-4">
              {timeline.filter(e => timelineFilter === 'all' || e.type === timelineFilter).length === 0 ? (
                <p className="text-sm text-slate-400 italic pl-14">No events found.</p>
              ) : (
                timeline.filter(e => timelineFilter === 'all' || e.type === timelineFilter).slice(0, 30).map((ev: any, idx: number) => {
                  const colors: Record<string, { bg: string; ring: string; icon: string }> = {
                    email: { bg: 'bg-violet-100', ring: 'ring-violet-300', icon: '✉️' },
                    call: { bg: 'bg-amber-100', ring: 'ring-amber-300', icon: '📞' },
                    invoice: { bg: 'bg-emerald-100', ring: 'ring-emerald-300', icon: '💰' },
                    milestone: { bg: 'bg-pink-100', ring: 'ring-pink-300', icon: '🎯' },
                    file: { bg: 'bg-sky-100', ring: 'ring-sky-300', icon: '📁' },
                    activity: { bg: 'bg-slate-100', ring: 'ring-slate-300', icon: '⚡' },
                  };
                  const c = colors[ev.type] || colors.activity;
                  return (
                    <motion.div key={`${ev.type}-${ev.id}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}
                      className="relative flex items-start gap-4 pl-14">
                      <div className={`absolute left-3.5 w-5 h-5 rounded-full ${c.bg} ring-2 ${c.ring} flex items-center justify-center text-[10px]`}>{c.icon}</div>
                      <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{ev.type}</span>
                            <p className="text-sm font-bold text-slate-800 mt-0.5">{ev.title}</p>
                            {ev.detail && <p className="text-xs text-slate-500 mt-1">{ev.detail}</p>}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">{ev.date ? new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>

      </div>
    </motion.div>

    {/* ── Edit Metrics Modal ── */}
    {isEditingMetrics && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200 rounded-3xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-black text-slate-800">Edit Performance Metrics</h3>
            <button onClick={() => setIsEditingMetrics(false)} className="p-2 text-slate-500 hover:text-slate-800 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Hero Stats */}
          <p className="text-xs font-black text-cyan-400 uppercase tracking-widest mb-3">Hero Stats</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([['total_revenue', 'Total Revenue (e.g. $152K)'], ['growth_rate', 'Growth Rate (e.g. +34%)']] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{label}</label>
                <input
                  value={metricsForm[key] || ''}
                  onChange={e => setMetricsForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
            ))}
          </div>

          {/* Performance Story */}
          <p className="text-xs font-black text-green-400 uppercase tracking-widest mb-3">Performance Story</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([
              ['monthly_revenue', 'Monthly Revenue (e.g. $34,560)'],
              ['revenue_growth_pct', 'Revenue Growth % (e.g. +28%)'],
              ['total_conversions', 'Total Conversions (e.g. 1,247)'],
              ['avg_conversion_value', 'Avg Conversion Value (e.g. $27.66)'],
              ['roi_multiple', 'ROI Multiple (e.g. 7.2x)'],
              ['roi_detail', 'ROI Detail (e.g. $720 back per $100)'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{label}</label>
                <input
                  value={metricsForm[key] || ''}
                  onChange={e => setMetricsForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-green-500"
                />
              </div>
            ))}
          </div>

          {/* Next Steps */}
          <p className="text-xs font-black text-orange-400 uppercase tracking-widest mb-3">Next Steps Forward</p>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">Campaign Progress (0–100)</label>
              <input
                type="number" min="0" max="100"
                value={metricsForm.campaign_progress || ''}
                onChange={e => setMetricsForm(p => ({ ...p, campaign_progress: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">Phase Note (e.g. Expansion Phase Ready)</label>
              <input
                value={metricsForm.campaign_phase_note || ''}
                onChange={e => setMetricsForm(p => ({ ...p, campaign_phase_note: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-400"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">Untapped Revenue Note (e.g. Potential +$84K annually)</label>
              <input
                value={metricsForm.untapped_revenue_note || ''}
                onChange={e => setMetricsForm(p => ({ ...p, untapped_revenue_note: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Detailed Insights */}
          <p className="text-xs font-black text-purple-400 uppercase tracking-widest mb-3">Detailed Insights</p>
          <div className="grid grid-cols-3 gap-3 mb-8">
            {([
              ['total_visitors', 'Total Visitors (e.g. 24.5K)'],
              ['engagement_rate', 'Engagement Rate (e.g. 68%)'],
              ['avg_time_on_site', 'Avg Time on Site (e.g. 4m 28s)'],
            ] as [string, string][]).map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1 block">{label}</label>
                <input
                  value={metricsForm[key] || ''}
                  onChange={e => setMetricsForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setIsEditingMetrics(false)}
              className="flex-1 py-3 border border-slate-300 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMetrics}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save Metrics'}
            </button>
          </div>
        </motion.div>
      </div>
    )}
    </>
  );
}

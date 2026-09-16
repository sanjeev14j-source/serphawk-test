"use client";

import { useState, useEffect } from "react";
import {
  Bell, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle, Loader2, ExternalLink
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useRole } from "@/context/RoleContext";
import Link from "next/link";
import PageGuide from '@/components/PageGuide';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string }> = {
  info:    { icon: Info,          color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-100" },
  success: { icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
  warning: { icon: AlertTriangle, color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-100" },
  error:   { icon: XCircle,       color: "text-red-600",     bg: "bg-red-50",     border: "border-red-100" },
};

export default function NotificationsPage() {
  const { user } = useRole();
  const userId = user?.id;
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    if (userId) fetchNotifications();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchNotifications() {
    setLoading(true);
    const res = await fetch(`${API_BASE_URL}/notifications/${userId}`);
    const data = await res.json();
    setNotifications(data.notifications || []);
    setLoading(false);
  }

  async function markRead(id: number) {
    await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: "PUT" });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    setMarkingAll(true);
    await fetch(`${API_BASE_URL}/notifications/mark-all-read/${userId}`, { method: "PUT" });
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarkingAll(false);
  }

  const unread = notifications.filter(n => !n.is_read).length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Bell className="w-7 h-7" /> Notifications
            {unread > 0 && (
              <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{unread}</span>
            )}
          </h1>
          <p className="text-gray-500 font-medium">All your alerts, updates, and reminders.</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} disabled={markingAll}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all">
            {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Mark all read
          </button>
        )}
      </div>

      <PageGuide
        pageKey="notifications"
        title="How Notifications work"
        description="Stay informed with real-time alerts about proposals, invoices, tasks, and team activity."
        steps={[
          { icon: '🔔', text: 'Notifications appear here whenever something important happens — new proposals, invoice updates, etc.' },
          { icon: '🟢', text: 'Color-coded badges indicate type: info (blue), success (green), warning (amber), error (red).' },
          { icon: '✅', text: 'Click \"Mark all read\" to clear the unread count, or click individual items to read them.' },
          { icon: '🔗', text: 'Some notifications have links — click them to jump directly to the relevant page.' },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-24">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-semibold">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map(n => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            return (
              <div
                key={n.id}
                onClick={() => !n.is_read && markRead(n.id)}
                className={cn(
                  "rounded-2xl border p-4 transition-all cursor-pointer",
                  n.is_read ? "bg-white opacity-60" : cn(cfg.bg, cfg.border, "hover:opacity-90"),
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-xl shrink-0", n.is_read ? "bg-gray-100" : cfg.bg)}>
                    <cfg.icon className={cn("w-4 h-4", n.is_read ? "text-gray-400" : cfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={cn("font-bold text-sm", n.is_read ? "text-gray-500" : "text-gray-900")}>{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                    </div>
                    <p className="text-sm text-gray-600">{n.message}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
                      {n.link && (
                        <Link href={n.link} className={cn("flex items-center gap-1 text-xs font-semibold", cfg.color)}>
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Send, Paperclip, Search, UserCheck, MessageCircle, RefreshCw, ArrowRight, CheckCheck, Check, Circle, Phone, Video, MoreHorizontal, Smile, Image, Mic } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useRole } from '@/context/RoleContext';
import Link from 'next/link';
import PageGuide from '@/components/PageGuide';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  'Pending':     { label: 'In Review',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'Quoted':      { label: 'Quote Sent', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'Accepted':    { label: 'Running',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  'In Progress': { label: 'Happening',  color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'Delivered':   { label: 'Done',       color: 'bg-slate-100 text-slate-600 border-slate-200' },
  'Hold':        { label: 'On Hold',    color: 'bg-rose-100 text-rose-700 border-rose-200' },
  'Cancelled':   { label: 'Cancelled',  color: 'bg-slate-200 text-slate-500 border-slate-300' },
};

const THREAD_COLORS = [
  'from-violet-400 to-indigo-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-600',
  'from-fuchsia-400 to-purple-600',
];

function threadColor(id: number) {
  return THREAD_COLORS[id % THREAD_COLORS.length];
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return isToday
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const LS_KEY = 'crm_msg_read_map';

export default function MessagesHubPage() {
  const { role, user } = useRole();
  const searchParams = useSearchParams();
  const threadIdParam = searchParams.get('thread_id');
  const clientIdParam = searchParams.get('client_id');

  const userId   = user?.id ?? null;
  const userName = user?.name || user?.email || 'You';

  const [threads, setThreads]               = useState<any[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [newMessage, setNewMessage]         = useState('');
  const [loading, setLoading]               = useState(true);
  const [sending, setSending]               = useState(false);
  const [filter, setFilter]                 = useState('All');
  const [search, setSearch]                 = useState('');
  // readMap: thread_id → number of messages seen last time user opened that thread
  const [readMap, setReadMap]               = useState<Record<number, number>>({});
  const [typingUsers, setTypingUsers]       = useState<Record<number, string>>({});  // user_id -> user_name
  const [readReceipts, setReadReceipts]     = useState<Record<number, boolean>>({}); // msg_id -> read

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadsRef     = useRef<any[]>([]);
  const wsRef          = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef    = useRef(false);

  // Load readMap from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setReadMap(JSON.parse(raw));
    } catch {}
  }, []);

  const markRead = useCallback((threadId: number, count: number) => {
    setReadMap(prev => {
      if ((prev[threadId] ?? 0) >= count) return prev;
      const next = { ...prev, [threadId]: count };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Fetch threads whenever userId is ready ─────────────────────────────────
  const fetchThreads = useCallback(async (silent = false) => {
    if (!userId) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/messages/${userId}`);
      const data = await res.json();
      const list: any[] = data.threads || [];

      // sort newest conversation first (highest latest message timestamp)
      const sorted = [...list].sort((a, b) => {
        const aTs = a.messages?.length ? new Date(a.messages[a.messages.length - 1].timestamp).getTime() : 0;
        const bTs = b.messages?.length ? new Date(b.messages[b.messages.length - 1].timestamp).getTime() : 0;
        return bTs - aTs;
      });

      // On silent polls, skip re-render if nothing changed
      if (silent && JSON.stringify(sorted) === JSON.stringify(threadsRef.current)) return;

      threadsRef.current = sorted;
      setThreads(sorted);

      if (!silent && list.length > 0) {
        // Determine which thread to select based on URL params or default to first
        let threadToSelect = list[0].thread_id;
        
        if (threadIdParam) {
          // Look for thread with specific thread_id
          const foundThread = list.find(t => t.thread_id === parseInt(threadIdParam));
          if (foundThread) {
            threadToSelect = foundThread.thread_id;
          }
        } else if (clientIdParam) {
          // Look for thread with specific client_id
          const foundThread = list.find(t => t.client_id === parseInt(clientIdParam));
          if (foundThread) {
            threadToSelect = foundThread.thread_id;
          }
        }
        
        setActiveThreadId(threadToSelect);
        const selectedThread = list.find(t => t.thread_id === threadToSelect);
        if (selectedThread) {
          markRead(threadToSelect, selectedThread.messages?.length ?? 0);
        }
      }
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId, markRead, threadIdParam, clientIdParam]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // ── WebSocket connection for active thread ─────────────────────────────
  const connectWs = useCallback((threadId: number) => {
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    const wsBase = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBase}/ws/chat/${threadId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'new_message') {
        const msg = data.message;
        setThreads(prev => {
          const updated = prev.map(t =>
            t.thread_id === threadId
              ? { ...t, messages: [...t.messages.filter((m: any) => !m._optimistic), { ...msg, isMe: msg.sender_id === userId }] }
              : t
          );
          // bring the updated thread to top
          const moved = updated.filter(t => t.thread_id !== threadId);
          const current = updated.find(t => t.thread_id === threadId);
          if (current) moved.unshift(current);
          return moved;
        });
        // Clear typing indicator for this sender
        setTypingUsers(prev => { const n = { ...prev }; delete n[msg.sender_id]; return n; });
      }

      if (data.type === 'typing') {
        setTypingUsers(prev => ({ ...prev, [data.user_id]: data.user_name }));
        // Auto-clear after 3s if no stop
        setTimeout(() => {
          setTypingUsers(prev => { const n = { ...prev }; delete n[data.user_id]; return n; });
        }, 3000);
      }

      if (data.type === 'stop_typing') {
        setTypingUsers(prev => { const n = { ...prev }; delete n[data.user_id]; return n; });
      }

      if (data.type === 'read_receipt') {
        setReadReceipts(prev => {
          const n = { ...prev };
          for (const id of data.message_ids) n[id] = true;
          return n;
        });
      }
    };

    ws.onclose = () => { wsRef.current = null; };

    return ws;
  }, [userId]);

  useEffect(() => {
    if (activeThreadId) {
      connectWs(activeThreadId);
      // Send read receipts for unread messages
      const thread = threads.find(t => t.thread_id === activeThreadId);
      if (thread && wsRef.current?.readyState === WebSocket.OPEN) {
        const unreadIds = thread.messages
          .filter((m: any) => !m.isMe && m.id && !m.is_read)
          .map((m: any) => m.id);
        if (unreadIds.length > 0) {
          wsRef.current.send(JSON.stringify({ action: 'read_receipt', message_ids: unreadIds, user_id: userId }));
        }
      }
    }
    return () => { if (wsRef.current) { wsRef.current.close(); wsRef.current = null; } };
  }, [activeThreadId, connectWs]);

  // ── Fallback poll every 30s (in case WS drops) ────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      if (wsRef.current?.readyState === WebSocket.OPEN) return;
      fetchThreads(true);
    }, 30000);
    return () => clearInterval(id);
  }, [fetchThreads]);

  const activeThread       = threads.find(t => t.thread_id === activeThreadId);
  const activeMessageCount = activeThread?.messages?.length ?? 0;

  // Auto-scroll when new messages arrive in the open thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadId, activeMessageCount]);

  // ── Open a thread ─────────────────────────────────────────────────────────
  const openThread = (thread: any) => {
    setActiveThreadId(thread.thread_id);
    markRead(thread.thread_id, thread.messages?.length ?? 0);
  };

  // ── Send message (preferring WebSocket) ────────────────────────────────
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThread || !userId || sending) return;

    const draft = newMessage;
    setNewMessage('');

    // Send typing stop
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: 'stop_typing', user_id: userId }));
    }
    isTypingRef.current = false;

    // Use WebSocket if connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Optimistic UI
      const optimisticMsg = { sender: userName, content: draft, timestamp: new Date().toISOString(), isMe: true, _optimistic: true };
      setThreads(prev =>
        prev.map(t =>
          t.thread_id === activeThreadId ? { ...t, messages: [...t.messages, optimisticMsg] } : t
        )
      );
      wsRef.current.send(JSON.stringify({ action: 'message', sender_id: userId, content: draft }));
      return;
    }

    // Fallback to REST
    setSending(true);
    const optimisticMsg = { sender: userName, content: draft, timestamp: new Date().toISOString(), isMe: true };
    setThreads(prev =>
      prev.map(t =>
        t.thread_id === activeThreadId ? { ...t, messages: [...t.messages, optimisticMsg] } : t
      )
    );
    try {
      const res = await fetch(`${API_BASE_URL}/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: activeThread.thread_id, sender_id: userId, content: draft }),
      });
      if (!res.ok) throw new Error('Send failed');
      fetchThreads(true);
    } catch {
      setThreads(prev =>
        prev.map(t =>
          t.thread_id === activeThreadId
            ? { ...t, messages: t.messages.filter((m: any) => m !== optimisticMsg) }
            : t
        )
      );
      setNewMessage(draft);
    } finally {
      setSending(false);
    }
  };

  // ── Typing indicator sender ────────────────────────────────────────────
  const handleTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      wsRef.current.send(JSON.stringify({ action: 'typing', user_id: userId, user_name: userName }));
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      wsRef.current?.send(JSON.stringify({ action: 'stop_typing', user_id: userId }));
    }, 2000);
  };

  const filteredThreads = threads.filter(t => {
    if (!(t.display_name || t.service_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === 'Running') return t.service_status === 'Accepted' || t.service_status === 'In Progress';
    if (filter === 'Done')    return t.service_status === 'Delivered';
    if (filter === 'Hold')    return t.service_status === 'Hold';
    return true;
  });

  const totalUnread = threads.reduce((acc, t) => {
    const cnt = t.messages?.length ?? 0;
    return acc + (cnt > (readMap[t.thread_id] ?? 0) && t.thread_id !== activeThreadId ? cnt - (readMap[t.thread_id] ?? 0) : 0);
  }, 0);

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">

      <PageGuide
        pageKey="messages"
        title="How Messages work"
        description="Your communication hub for all service-related conversations with your team."
        steps={[
          { icon: '💬', text: 'Each thread is linked to a service request — select one from the left panel to start chatting.' },
          { icon: '🔍', text: 'Use the search bar and filter tabs (All, Running, Done, Hold) to find specific conversations.' },
          { icon: '🔔', text: 'Unread messages show a badge count — click a thread to mark it as read.' },
          { icon: '⌨️', text: 'Press Enter to send a message, or Shift+Enter for a new line.' },
        ]}
      />

      {/* ── Conversations Container ─────────────────────────────────────── */}
      <div className="flex-1 flex bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-0">

        {/* ── Left Panel: Threads ──────────────────────────────────────── */}
        <div className="w-[340px] shrink-0 border-r border-gray-100 flex flex-col bg-gray-50/50">

          {/* Panel header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-black text-gray-900 tracking-tight">Messages</h1>
                  <p className="text-[11px] text-gray-400 font-medium">
                    {totalUnread > 0 ? `${totalUnread} unread` : `${threads.length} conversation${threads.length !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => fetchThreads()}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl py-2.5 pl-9 pr-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder:text-gray-400 transition-all"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-1.5">
              {['All', 'Running', 'Done', 'Hold'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filter === f
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400 font-medium">Loading…</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="py-20 px-6 text-center space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto">
                  <MessageCircle className="w-7 h-7 text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-500">No conversations yet</p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    A chat thread is created when you place a service request.
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Browse Services <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="p-2 space-y-0.5">
                {filteredThreads.map(thread => {
                  const status    = STATUS_MAP[thread.service_status] || { label: thread.service_status || 'Active', color: 'bg-gray-100 text-gray-600 border-gray-200' };
                  const lastMsg   = thread.messages?.[thread.messages.length - 1];
                  const isActive  = activeThreadId === thread.thread_id;
                  const seenCount = readMap[thread.thread_id] ?? 0;
                  const msgCount  = thread.messages?.length ?? 0;
                  const unreadCount = !isActive && msgCount > seenCount ? msgCount - seenCount : 0;
                  const initials  = (thread.display_name || thread.service_name || 'S').substring(0, 2).toUpperCase();

                  return (
                    <button
                      key={thread.thread_id}
                      onClick={() => openThread(thread)}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                        isActive
                          ? 'bg-indigo-50 border border-indigo-200'
                          : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${threadColor(thread.thread_id)} flex items-center justify-center text-white text-xs font-black shadow-sm`}>
                            {initials}
                          </div>
                          {unreadCount > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-indigo-600 text-white rounded-full text-[9px] font-black flex items-center justify-center ring-2 ring-white">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <h3 className={`text-sm truncate ${unreadCount > 0 ? 'font-black text-gray-900' : 'font-semibold text-gray-800'}`}>
                              {thread.display_name || thread.service_name}
                            </h3>
                            {lastMsg && (
                              <span className="text-[10px] text-gray-400 font-medium shrink-0">{fmtTime(lastMsg.timestamp)}</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs truncate ${unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                              {lastMsg
                                ? `${lastMsg.isMe ? 'You' : lastMsg.sender}: ${lastMsg.content}`
                                : 'No messages yet'}
                            </p>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold border ${status.color}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Chat ───────────────────────────────────────── */}
        {activeThread ? (
          <div className="flex-1 flex flex-col min-w-0 bg-white">

            {/* Chat header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${threadColor(activeThread.thread_id)} flex items-center justify-center text-white text-xs font-black shadow-sm`}>
                  {(activeThread.display_name || activeThread.service_name || 'S').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-sm text-gray-900">{activeThread.display_name || activeThread.service_name}</h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-gray-500">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      {activeThread.handler}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${STATUS_MAP[activeThread.service_status]?.color || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {STATUS_MAP[activeThread.service_status]?.label || activeThread.service_status || 'Active'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <Phone className="w-4 h-4" />
                </button>
                <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <Video className="w-4 h-4" />
                </button>
                <button className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages feed */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
              {activeThread.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <MessageCircle className="w-7 h-7 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-500">Start the conversation</p>
                    <p className="text-xs text-gray-400 mt-0.5 max-w-xs">Send a message to connect with your team about this service.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Date separator at top */}
                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Conversation Start</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>

                  {activeThread.messages.map((msg: any, idx: number) => {
                    const isSystem = msg.sender === 'System';
                    const isMe = msg.isMe;

                    if (isSystem) {
                      return (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-[10px] font-semibold text-gray-400 px-3 py-1 bg-gray-100 rounded-full">
                            {msg.content}
                          </span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-black shadow-sm ${
                          isMe
                            ? 'bg-gradient-to-br from-indigo-500 to-violet-600'
                            : `bg-gradient-to-br ${threadColor(activeThread.thread_id)}`
                        }`}>
                          {isMe ? (userName || 'Y').charAt(0).toUpperCase() : (msg.sender || 'T').charAt(0).toUpperCase()}
                        </div>

                        {/* Bubble */}
                        <div className={`max-w-[65%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          <span className={`text-[10px] font-semibold mb-1 px-1 ${isMe ? 'text-gray-400 text-right self-end' : 'text-gray-500'}`}>
                            {isMe ? 'You' : msg.sender}
                          </span>
                          <div className={`rounded-2xl px-4 py-2.5 ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-sm'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
                          }`}>
                            <p className="text-[13px] leading-relaxed">{msg.content}</p>
                          </div>
                          <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? 'self-end' : ''}`}>
                            <span className="text-[10px] text-gray-400">{fmtTime(msg.timestamp)}</span>
                            {isMe && (
                              msg.is_read || readReceipts[msg.id]
                                ? <CheckCheck className="w-3 h-3 text-blue-500" />
                                : <Check className="w-3 h-3 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              {/* Typing indicator */}
              {Object.keys(typingUsers).length > 0 && (
                <div className="flex gap-2.5">
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-[10px] font-black bg-gradient-to-br ${threadColor(activeThread.thread_id)}`}>
                    {Object.values(typingUsers)[0]?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-semibold mb-1 px-1 text-gray-500">
                      {Object.values(typingUsers).join(', ')}
                    </span>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="px-5 py-4 border-t border-gray-100 shrink-0 bg-white">
              <form
                onSubmit={handleSendMessage}
                className="flex items-end gap-2"
              >
                <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex items-end gap-1 px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                  <button type="button" className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors shrink-0">
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onInput={handleTyping}
                    placeholder={role === 'Client' ? `Message ${activeThread.handler}…` : 'Type your reply…'}
                    rows={1}
                    className="flex-1 bg-transparent py-2 text-sm focus:outline-none resize-none max-h-28 placeholder:text-gray-400"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(e); }
                    }}
                  />
                  <button type="button" className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg transition-colors shrink-0">
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="w-11 h-11 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-xl flex items-center justify-center transition-all shrink-0 shadow-sm active:scale-95"
                >
                  {sending
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-4 h-4" />
                  }
                </button>
              </form>
            </div>
          </div>
        ) : (
          /* ── Empty state ───────────────────────────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center p-10 bg-gray-50/30">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-5">
              <MessageCircle className="w-9 h-9 text-indigo-300" />
            </div>
            {loading ? (
              <p className="text-sm font-bold text-gray-400 animate-pulse">Loading your threads…</p>
            ) : threads.length > 0 ? (
              <div className="text-center">
                <h3 className="text-lg font-black text-gray-700">Select a conversation</h3>
                <p className="text-sm font-medium mt-1.5 text-gray-400 max-w-xs">
                  Choose a thread from the left to start messaging.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <h3 className="text-lg font-black text-gray-700">No conversations yet</h3>
                <p className="text-sm font-medium mt-1.5 text-gray-400 max-w-xs">
                  A chat thread opens automatically once you place a service request.
                </p>
                <Link
                  href="/pricing"
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  Browse Services <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

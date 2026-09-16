"use client";

import { useState, useEffect } from "react";
import {
  Plus, X, Loader2, TrendingUp, TrendingDown, Minus,
  Search, BarChart2, Target, RefreshCw, Trash2
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { cn } from "@/lib/utils";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';

interface RankEntry {
  id: number;
  client_id: number;
  keyword: string;
  position?: number;
  url?: string;
  search_engine: string;
  notes?: string;
  recorded_at: string;
}

interface Client { id: number; companyName?: string; name?: string; }

function positionBadge(pos?: number) {
  if (!pos) return <span className="text-gray-400 text-sm">N/A</span>;
  const color = pos <= 3 ? "text-emerald-700 bg-emerald-100" :
    pos <= 10 ? "text-blue-700 bg-blue-100" :
    pos <= 20 ? "text-amber-700 bg-amber-100" : "text-red-700 bg-red-100";
  return <span className={cn("text-sm font-black px-2 py-0.5 rounded-full", color)}>#{pos}</span>;
}

export default function RankingsPage() {
  const { role, user } = useRole();
  const isClient = role === "Client";
  const clientId = user?.client_id;
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterClient, setFilterClient] = useState<string>("all");
  const [searchKw, setSearchKw] = useState("");

  const [form, setForm] = useState({
    client_id: "", keyword: "", position: "",
    url: "", search_engine: "Google", notes: "",
  });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const rankUrl = isClient && clientId
      ? `${API_BASE_URL}/rankings?client_id=${clientId}`
      : `${API_BASE_URL}/rankings`;
    const [r, c] = await Promise.all([
      fetch(rankUrl).then(res => res.json()),
      isClient ? Promise.resolve({ clients: [] }) : fetch(`${API_BASE_URL}/clients`).then(res => res.json()),
    ]);
    setRankings(r.rankings || []);
    setClients(c.clients || []);
    setLoading(false);
  }

  async function addRanking(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`${API_BASE_URL}/rankings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Number(form.client_id),
        keyword: form.keyword,
        position: form.position ? Number(form.position) : null,
        url: form.url || null,
        search_engine: form.search_engine,
        notes: form.notes || null,
      }),
    });
    setShowModal(false);
    setForm({ client_id: "", keyword: "", position: "", url: "", search_engine: "Google", notes: "" });
    fetchAll();
    setSubmitting(false);
  }

  async function deleteEntry(id: number) {
    await fetch(`${API_BASE_URL}/rankings/${id}`, { method: "DELETE" });
    setRankings(prev => prev.filter(r => r.id !== id));
  }

  const clientName = (id: number) => {
    const c = clients.find(c => c.id === id);
    return c?.companyName || c?.name || `Client #${id}`;
  };

  const filtered = rankings.filter(r =>
    (filterClient === "all" || r.client_id === Number(filterClient)) &&
    (!searchKw || r.keyword.toLowerCase().includes(searchKw.toLowerCase()))
  );

  // Group by keyword for the summary section (latest entry per keyword per client)
  const latestByKey: Record<string, RankEntry> = {};
  [...rankings].reverse().forEach(r => {
    const k = `${r.client_id}::${r.keyword}`;
    if (!latestByKey[k]) latestByKey[k] = r;
  });

  const top10 = Object.values(latestByKey).filter(r => r.position && r.position <= 10).length;
  const top3  = Object.values(latestByKey).filter(r => r.position && r.position <= 3).length;
  const avgPos = Object.values(latestByKey).filter(r => r.position).reduce((s, r) => s + (r.position || 0), 0) /
    (Object.values(latestByKey).filter(r => r.position).length || 1);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{isClient ? "My SEO Rankings" : "Keyword Rankings"}</h1>
          <p className="text-gray-500 font-medium">{isClient ? "Track your keyword positions and search visibility." : "Track keyword positions and monitor SEO performance."}</p>
        </div>
        {!isClient && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg transition-all active:scale-95">
            <Plus className="w-4 h-4" /> Log Ranking
          </button>
        )}
      </div>

      <PageGuide
        pageKey="rankings"
        title={isClient ? 'Understanding Your SEO Rankings' : 'How Keyword Rankings work'}
        description={isClient ? 'Track how your keywords rank across search engines over time.' : 'Log and monitor keyword positions across clients and search engines.'}
        steps={isClient ? [
          { icon: '📍', text: 'Each row shows a keyword, its current position, and which search engine it was tracked on.' },
          { icon: '🟢', text: 'Green badges (positions 1–3) mean your keyword is ranking excellently.' },
          { icon: '🟡', text: 'Amber badges (positions 4–20) mean there\'s room for improvement.' },
          { icon: '📈', text: 'Rankings are updated regularly by your SEO team to reflect current performance.' },
        ] : [
          { icon: '➕', text: 'Click \"Log Ranking\" to record a keyword position for a client and search engine.' },
          { icon: '📊', text: 'The stats bar shows total keywords, top 3, top 10, and average position.' },
          { icon: '🔍', text: 'Use the search and filter options to find specific keywords or clients.' },
          { icon: '📈', text: 'Position badges are color-coded: green (1–3), blue (4–10), amber (11–20), red (20+).' },
        ]}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Keywords Tracked", value: Object.keys(latestByKey).length, icon: Target, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Top 3 Positions", value: top3, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Top 10 Positions", value: top10, icon: BarChart2, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Avg Position", value: isNaN(avgPos) ? "—" : avgPos.toFixed(1), icon: Minus, color: "text-amber-600", bg: "bg-amber-50" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-2xl p-4 flex items-center gap-3", s.bg)}>
            <s.icon className={cn("w-6 h-6", s.color)} />
            <div>
              <p className="text-xs text-gray-500 font-semibold">{s.label}</p>
              <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={searchKw} onChange={e => setSearchKw(e.target.value)}
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Search keywords..." />
        </div>
        {!isClient && (
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name || `Client #${c.id}`}</option>)}
          </select>
        )}
      </div>

      {/* Rankings Table */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {["Keyword", "Client", "Position", "Search Engine", "URL", "Date", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16 text-gray-400">No rankings logged yet</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 font-semibold text-gray-900">{r.keyword}</td>
                  <td className="px-4 py-4 text-gray-600">{clientName(r.client_id)}</td>
                  <td className="px-4 py-4">{positionBadge(r.position)}</td>
                  <td className="px-4 py-4 text-gray-500">{r.search_engine}</td>
                  <td className="px-4 py-4">
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline text-xs truncate max-w-[140px] block">
                        {r.url.replace(/^https?:\/\//, "")}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-4 text-gray-400 text-xs">{new Date(r.recorded_at).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    {!isClient && (
                      <button onClick={() => deleteEntry(r.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Ranking Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">Log Keyword Ranking</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={addRanking} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Client *</label>
                <select required value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.companyName || c.name || `Client #${c.id}`}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Keyword *</label>
                  <input required value={form.keyword} onChange={e => setForm(p => ({ ...p, keyword: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. plumber near me" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Position #</label>
                  <input type="number" min="1" max="200" value={form.position}
                    onChange={e => setForm(p => ({ ...p, position: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. 5" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Ranking URL</label>
                <input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="https://clientsite.com/page" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Search Engine</label>
                <select value={form.search_engine} onChange={e => setForm(p => ({ ...p, search_engine: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {["Google", "Bing", "Yahoo", "DuckDuckGo"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Optional notes..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={submitting}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

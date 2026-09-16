"use client";

import { useState, useEffect } from "react";
import {
  Upload, X, Loader2, FileText, FileImage, File, Trash2, Download, Plus
} from "lucide-react";
import { API_BASE_URL } from "@/config";
import { useRole } from "@/context/RoleContext";
import PageGuide from '@/components/PageGuide';

interface ClientFile {
  id: number;
  filename: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  description?: string;
  uploaded_by: number;
  created_at: string;
}

function fileIcon(mime?: string) {
  if (!mime) return <File className="w-5 h-5 text-gray-400" />;
  if (mime.startsWith("image/")) return <FileImage className="w-5 h-5 text-purple-500" />;
  if (mime.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />;
  return <FileText className="w-5 h-5 text-blue-500" />;
}

function formatSize(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function MyFilesPage() {
  const { user } = useRole();
  const [clientId, setClientId] = useState<number | null>(user?.client_id || null);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");

  // Resolve client profile id for current user
  useEffect(() => {
    if (user?.client_id) {
      setClientId(user.client_id);
      return;
    }
    async function resolveClient() {
      if (!user?.id) return;
      try {
        const res = await fetch(`${API_BASE_URL}/clients`);
        const data = await res.json();
        const clients = data.clients || [];
        const match = clients.find((c: any) => c.userId === user.id);
        if (match) {
          setClientId(match.id);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
      }
    }
    resolveClient();
  }, [user?.id, user?.client_id]);

  useEffect(() => {
    if (clientId) fetchFiles();
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchFiles() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients/${clientId}/files`);
      const data = await res.json();
      setFiles(data.files || []);
    } finally {
      setLoading(false);
    }
  }

  async function uploadFile(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !user?.id || !selectedFile) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const params = new URLSearchParams({
        client_id: String(clientId),
        uploaded_by: String(user.id),
      });
      if (description) params.append("description", description);

      await fetch(`${API_BASE_URL}/upload-file?${params}`, {
        method: "POST",
        body: formData,
      });
      setShowModal(false);
      setSelectedFile(null);
      setDescription("");
      fetchFiles();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteFile(id: number) {
    if (!confirm("Delete this file?")) return;
    await fetch(`${API_BASE_URL}/files/${id}`, { method: "DELETE" });
    setFiles(prev => prev.filter(f => f.id !== id));
  }

  if (!clientId && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500">
        No client profile found for this account.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">My Files</h1>
          <p className="text-gray-500 font-medium">Documents &amp; files shared with your team.</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:bg-black shadow-lg transition-all active:scale-95">
          <Plus className="w-4 h-4" /> Add File
        </button>
      </div>

      <PageGuide
        pageKey="my-files"
        title="How My Files works"
        description="Upload, organize, and share documents with your team securely."
        steps={[
          { icon: '📂', text: 'Click \"Add File\" to upload documents, images, PDFs, or any file up to the size limit.' },
          { icon: '📝', text: 'Add a description when uploading so your team knows what each file is for.' },
          { icon: '⬇️', text: 'Download any file by clicking the download button on the file card.' },
          { icon: '🗑️', text: 'Remove files you no longer need using the delete action.' },
        ]}
      />

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
      ) : (
        <div className="space-y-3">
          {files.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No files uploaded yet.<br />Click <strong>Add File</strong> to share a document.</p>
            </div>
          )}
          {files.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-center gap-4 group hover:shadow-md transition-all">
              <div className="shrink-0">
                {fileIcon(f.mime_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{f.filename}</p>
                <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                  {f.description && <span>{f.description}</span>}
                  {f.file_size && <span>{formatSize(f.file_size)}</span>}
                  {f.mime_type && <span>{f.mime_type}</span>}
                  <span>{new Date(f.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={f.file_url.startsWith("/static") ? `${API_BASE_URL}${f.file_url}` : f.file_url} target="_blank" rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-all" title="Open file">
                  <Download className="w-4 h-4" />
                </a>
                <button onClick={() => deleteFile(f.id)}
                  className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black">Add File</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={uploadFile} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Choose File *</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                  {selectedFile ? (
                    <div className="text-center px-4">
                      <FileText className="w-8 h-8 text-indigo-500 mx-auto mb-1" />
                      <p className="text-sm font-bold text-gray-900 truncate max-w-[250px]">{selectedFile.name}</p>
                      <p className="text-xs text-gray-400">{formatSize(selectedFile.size)}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                      <p className="text-sm text-gray-500 font-medium">Click to select a file</p>
                      <p className="text-xs text-gray-400">PDF, images, docs, etc.</p>
                    </div>
                  )}
                  <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Monthly report, contract, etc." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setSelectedFile(null); setDescription(""); }}
                  className="flex-1 py-2.5 border rounded-xl font-bold text-sm text-gray-600">Cancel</button>
                <button type="submit" disabled={submitting || !selectedFile}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /> Upload</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

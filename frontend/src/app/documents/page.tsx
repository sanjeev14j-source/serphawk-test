"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, FileText, Loader2, Check, User, Building, Phone, Mail, Globe, Save, Camera, X, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import PageGuide from '@/components/PageGuide';

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    mobile: '',
    email: '',
    website: ''
  });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
      setOcrError(null);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please check permissions.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (blob) {
            const capturedFile = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
            setFile(capturedFile);
            setPreview(URL.createObjectURL(capturedFile));
            setResult(null);
            stopCamera();
          }
        }, 'image/jpeg');
      }
    }
  };

  const compressImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimension 1500px is enough for OCR
          const MAX_DIMENSION = 1500;
          if (width > height) {
            if (width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(blob as Blob);
          }, 'image/jpeg', 0.8); // 80% quality JPEG
        };
      };
    });
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setAnalyzing(true);
    setOcrError(null);
    setResult(null);

    try {
      // Compress image before sending
      const compressedBlob = await compressImage(file);

      const formDataPayload = new FormData();
      formDataPayload.append('file', compressedBlob, "image.jpg");

      const res = await fetch(`${API_BASE_URL}/documents/ocr`, {
        method: 'POST',
        body: formDataPayload,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        setOcrError(errData.detail || `Server error: ${res.status}`);
        return;
      }

      const data = await res.json();

      // Check if API returned an error inside the response body
      if (data.error) {
        setOcrError(`OCR Error: ${data.error}`);
        return;
      }

      setResult(data);
      setFormData({
        name: data.name || '',
        company_name: data.company_name || '',
        mobile: data.mobile || '',
        email: data.email || '',
        website: data.website || ''
      });
      setSaved(false);
    } catch (err: any) {
      console.error(err);
      setOcrError(`Network error: ${err.message || 'Could not connect to server'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveAsLead = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: formData.company_name || 'Individual',
          websiteUrl: formData.website || '',
          email: formData.email,
          projectName: `OCR Lead - ${formData.name}`,
          tagline: `Extracted from business card for ${formData.name}`
        }),
      });

      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 5000);
      } else {
        const error = await res.json();
        alert(`Error: ${error.detail || 'Failed to save lead'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div className="bg-white p-8 rounded-xl border shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" /> Document OCR
        </h1>
        <p className="text-gray-500 mb-8">Upload an ID card or business card to automatically extract details.</p>

        <PageGuide
          pageKey="documents"
          title="How Document OCR works"
          description="Scan business cards, ID cards, or documents to automatically extract contact information."
          steps={[
            { icon: '📷', text: 'Upload an image or use your camera to capture a business card or ID document.' },
            { icon: '🤖', text: 'Our AI will analyze the image and extract details like name, company, phone, email, and website.' },
            { icon: '✏️', text: 'Review and edit the extracted data before saving it to your contacts.' },
            { icon: '💾', text: 'Click \"Save as Client\" to add the extracted contact directly to your client database.' },
          ]}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="space-y-4">
            {!isCameraOpen ? (
              <>
                <div className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center transition-colors relative h-64 ${file ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}>
                  {preview ? (
                    <img src={preview} alt="Preview" className="max-h-full rounded-lg shadow-sm object-contain" />
                  ) : (
                    <div className="text-gray-400">
                      <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Click to upload or drag and drop</p>
                      <p className="text-xs mt-2">JPG, PNG up to 5MB</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={analyzing}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={startCamera}
                    disabled={analyzing}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Use Camera
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || !file}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : 'Analyze'}
                  </button>
                </div>
                {ocrError && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                    <span className="font-bold">⚠ Error:</span>
                    <span>{ocrError}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-black h-64 flex items-center justify-center">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover"></video>
                  <canvas ref={canvasRef} className="hidden"></canvas>
                  <button
                    onClick={stopCamera}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={capturePhoto}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Capture Photo
                </button>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="space-y-4">
            {result ? (
              <div className="bg-gray-50 p-6 rounded-xl border space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 border-b pb-2">
                  <Check className="w-4 h-4 text-green-600" /> Extracted Details
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1">
                      <User className="w-3 h-3" /> Name
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1">
                      <Building className="w-3 h-3" /> Company
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1">
                      <Phone className="w-3 h-3" /> Mobile
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1">
                      <Mail className="w-3 h-3" /> Email
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1">
                      <Globe className="w-3 h-3" /> Website
                    </label>
                    <input
                      className="w-full p-2 border rounded-lg bg-white"
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveAsLead}
                  disabled={saving || !formData.email}
                  className={`w-full py-2 rounded-lg font-bold mt-4 flex items-center justify-center gap-2 transition-colors ${saved ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : saved ? (
                    <><CheckCircle2 className="w-4 h-4" /> Lead Saved!</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save as Lead</>
                  )}
                </button>
                {!formData.email && <p className="text-[10px] text-red-500 text-center mt-1">Email is required to save as lead</p>}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl p-8 text-center bg-gray-50">
                {analyzing ? (
                  <div className="space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                    <p>Extracting text from image...</p>
                  </div>
                ) : (
                  <p>Upload an image or take a photo to see results here</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

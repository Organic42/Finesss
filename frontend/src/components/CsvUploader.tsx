'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface CsvUploaderProps {
  onUploadSuccess: () => void; // Function to run after successful upload (e.g., refresh charts)
}

export default function CsvUploader({ onUploadSuccess }: CsvUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setStatus('idle');

    const formData = new FormData();
    formData.append('file', file);
    // Optional: Add userId if your backend expects it
    formData.append('userId', 'default_user'); 

    try {
      const res = await fetch(`${API_BASE}/transactions/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload file. Check backend logs.');

      setStatus('success');
      setMessage('Data successfully ingested into the database!');
      setFile(null); // Clear the file
      
      // Trigger the parent component to refresh its data
      onUploadSuccess();
      
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mb-4 text-indigo-400">
        <UploadCloud size={32} />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">Upload Financial Data</h3>
      <p className="text-slate-400 text-sm mb-6 max-w-sm">
        Upload your MSME synthetic dataset (.csv) to generate instant AI insights and train the XGBoost forecasting model.
      </p>

      {/* Hidden File Input */}
      <input 
        type="file" 
        accept=".csv" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
      />

      {/* Upload Controls */}
      {!file ? (
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium transition-all"
        >
          Select CSV File
        </button>
      ) : (
        <div className="flex flex-col items-center w-full">
          <div className="flex items-center gap-3 bg-white/5 px-4 py-3 rounded-lg border border-white/10 mb-4 w-full justify-center">
            <FileText className="text-indigo-400" size={20} />
            <span className="text-slate-200 text-sm truncate max-w-[200px]">{file.name}</span>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setFile(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleUpload}
              disabled={isUploading}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="animate-spin" size={16} /> : <UploadCloud size={16} />}
              {isUploading ? 'Uploading & Processing...' : 'Upload & Analyze'}
            </button>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {status === 'success' && (
        <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 px-4 py-2 rounded-lg border border-emerald-400/20">
          <CheckCircle size={16} /> {message}
        </div>
      )}
      {status === 'error' && (
        <div className="mt-4 flex items-center gap-2 text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">
          <AlertCircle size={16} /> {message}
        </div>
      )}
    </div>
  );
}
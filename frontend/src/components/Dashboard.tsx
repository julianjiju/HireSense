import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, Sparkles, BarChart3, AlertCircle, Brain,
  ChevronRight, Eye, X, Zap, Target, TrendingUp, Users, Shield,
  Award, CheckCircle2, XCircle, Plus, Briefcase, LayoutDashboard
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import axios from 'axios';

const API_URL = '/api'; // Using relative path for Vercel deployment

// ─── Types ───────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  description: string;
  created_at: string;
}

interface Candidate {
  resume_id: string;
  filename: string;
  match: {
    score: number;
    justification: string;
    source: string;
    breakdown: {
      experience: number;
      skills: number;
      semantic: number;
      completeness: number;
    };
    strengths?: string[];
    missing_skills?: string[];
    recommendation?: string;
  };
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'ranking'>('overview');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  
  const [files, setFiles] = useState<{file: File, status: 'queued' | 'parsing' | 'done' | 'failed'}[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState('');

  // 1. Fetch Jobs
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const res = await axios.get(`${API_URL}/jobs`);
        if (res.data.success) {
          setJobs(res.data.jobs);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || "Database connection failed. Ensure SUPABASE_URL and KEYS are set in .env");
      }
    };
    fetchJobs();
  }, []);

  // 2. Job Creation
  const handleCreateJob = async () => {
    if (!newJobTitle.trim()) return;
    try {
      const res = await axios.post(`${API_URL}/jobs`, { title: newJobTitle });
      if (res.data.success) {
        setJobs([res.data.job, ...jobs]);
        setActiveJob(res.data.job);
        setIsCreatingJob(false);
        setNewJobTitle('');
      }
    } catch (err) {
      setError("Failed to create job");
    }
  };

  // 3. File Upload Tracking
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles.map(f => ({ file: f, status: 'queued' as const }))]);
  }, []);
  
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }
  });

  const uploadFiles = async () => {
    if (!activeJob) return;
    setIsProcessing(true);
    
    for (const fileItem of files) {
      if (fileItem.status === 'done') continue;
      
      const idx = files.indexOf(fileItem);
      const updateStatus = (status: any) => {
        setFiles(prev => prev.map((item, i) => i === idx ? { ...item, status } : item));
      };

      updateStatus('parsing');
      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('job_id', activeJob.id);

      try {
        await axios.post(`${API_URL}/upload`, formData);
        updateStatus('done');
      } catch (err) {
        updateStatus('failed');
      }
    }
    setIsProcessing(false);
  };

  const handleRank = async () => {
    if (!activeJob || !jobDescription.trim()) return;
    setIsProcessing(true);
    try {
      const res = await axios.post(`${API_URL}/rank`, {
        job_id: activeJob.id,
        job_description: jobDescription
      });
      if (res.data.success) {
        setCandidates(res.data.results);
        setActiveTab('ranking');
      }
    } catch (err) {
      setError("Ranking failed");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-72 bg-[#0b1120] border-r border-white/5 flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">HireSense</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          <nav className="space-y-1">
            <button onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${activeTab === 'overview' ? 'bg-white/5 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard Overview
            </button>
          </nav>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active Job Roles</h3>
              <button onClick={() => setIsCreatingJob(true)} className="text-indigo-400 hover:text-indigo-300">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1">
              {jobs.map(job => (
                <button key={job.id} onClick={() => { setActiveJob(job); setActiveTab('overview'); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 group transition-all ${activeJob?.id === job.id ? 'bg-indigo-500/10 text-indigo-300' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                  <Briefcase className="w-3.5 h-3.5" />
                  <span className="truncate flex-1">{job.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5">
          <div className="bg-white/[0.02] rounded-xl p-3 text-center border border-white/5">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Status</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-medium text-slate-300">Production Ready</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 shrink-0 bg-[#0b1120]/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {activeJob ? (
              <>
                <h2 className="text-lg font-bold text-white">{activeJob.title}</h2>
                <Badge variant="outline" className="text-[10px] border-white/10 uppercase font-bold tracking-wider">Active Batch</Badge>
              </>
            ) : (
              <h2 className="text-lg font-bold text-slate-400 italic">Select a Job Role to begin</h2>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('upload')} disabled={!activeJob}>Upload</Button>
            <Button variant="neon" size="sm" onClick={() => setActiveTab('ranking')} disabled={!activeJob}>Ranking</Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {!activeJob ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-indigo-500/10 rounded-3xl flex items-center justify-center mb-6">
                  <Briefcase className="w-10 h-10 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No Active Job Role</h3>
                <p className="text-slate-500 max-w-sm mb-8">Create or select a job role from the sidebar to start uploading resumes and ranking talent.</p>
                <Button variant="neon" onClick={() => setIsCreatingJob(true)}>Create First Job Role</Button>
              </motion.div>
            ) : activeTab === 'overview' ? (
              <motion.div key="overview" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-6">
                    <Users className="w-8 h-8 text-indigo-400 mb-4" />
                    <h4 className="text-2xl font-bold text-white">{candidates.length}</h4>
                    <p className="text-sm text-slate-400">Total Applicants Ranked</p>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
                    <Award className="w-8 h-8 text-emerald-400 mb-4" />
                    <h4 className="text-2xl font-bold text-white">
                      {candidates.filter(c => c.match.score >= 80).length}
                    </h4>
                    <p className="text-sm text-slate-400">Top Potential Hires</p>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6">
                    <Sparkles className="w-8 h-8 text-amber-400 mb-4" />
                    <h4 className="text-2xl font-bold text-white">
                      {candidates.length > 0 ? (candidates.reduce((a,b) => a + b.match.score, 0) / candidates.length).toFixed(0) : 0}%
                    </h4>
                    <p className="text-sm text-slate-400">Avg Candidate Match</p>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                  <h3 className="text-lg font-bold text-white mb-6">Job Description Analysis</h3>
                  <textarea 
                    className="w-full h-40 bg-transparent border border-white/10 rounded-2xl p-6 text-slate-300 focus:outline-none focus:border-indigo-500/50 transition-all text-sm leading-relaxed"
                    placeholder="Describe the ideal candidate..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                  <div className="flex justify-end mt-4">
                    <Button variant="neon" size="lg" onClick={handleRank} disabled={isProcessing || !jobDescription.trim()}>
                      {isProcessing ? "Processing AI..." : "Update AI Ranking"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'upload' ? (
              <motion.div key="upload" className="space-y-6">
                <div {...getRootProps()} className={`border-2 border-dashed rounded-3xl p-20 text-center transition-all cursor-pointer ${isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/10 hover:border-white/20'}`}>
                  <input {...getInputProps()} />
                  <UploadCloud className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-white">Drop Resumes Here</h3>
                  <p className="text-slate-500 text-sm mt-1">PDF, DOCX, or Image (JPG, PNG)</p>
                </div>

                {files.length > 0 && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-slate-400">Queue ({files.length})</h4>
                      <Button variant="neon" size="sm" onClick={uploadFiles} disabled={isProcessing}>Process Batch</Button>
                    </div>
                    <div className="space-y-2">
                      {files.map((fileItem, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                          <span className="text-sm truncate w-64">{fileItem.file.name}</span>
                          <div className="flex items-center gap-3">
                             {fileItem.status === 'parsing' && <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                             <Badge variant={fileItem.status === 'done' ? 'success' : fileItem.status === 'failed' ? 'destructive' : 'outline'} className="text-[10px] uppercase">
                               {fileItem.status}
                             </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="ranking" className="space-y-6 pb-20">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-extrabold text-white">Candidate Rankings</h3>
                  <span className="text-xs text-slate-500">Sorted by AI Score</span>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-3xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/[0.03] text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                        <th className="px-6 py-4">Candidate</th>
                        <th className="px-6 py-4">Score</th>
                        <th className="px-6 py-4">AI Justification</th>
                        <th className="px-6 py-4">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {candidates.map(c => (
                        <tr key={c.resume_id} className="hover:bg-white/[0.01] group transition-all">
                          <td className="px-6 py-5">
                            <span className="text-sm font-bold text-indigo-300">{c.filename.split('.')[0]}</span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <span className={`text-lg font-black ${c.match.score >= 80 ? 'text-emerald-400' : c.match.score >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                                {c.match.score}
                              </span>
                              <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
                                <div className="h-full bg-indigo-500" style={{ width: `${c.match.score}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5 max-w-md">
                            <p className="text-xs text-slate-400 leading-relaxed italic">{c.match.justification}</p>
                          </td>
                          <td className="px-6 py-5">
                            <Badge variant={c.match.source === 'gemini' ? 'neon' : 'outline'} className="text-[9px]">
                              {c.match.source}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Modal for Creating Job */}
      <AnimatePresence>
        {isCreatingJob && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl bg-black/40">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#0b1120] border border-white/10 rounded-[32px] p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-bold text-white mb-6">Create New Job Role</h3>
              <input 
                autoFocus
                className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 mb-6"
                placeholder="Job Title (e.g. Senior Frontend Dev)"
                value={newJobTitle}
                onChange={(e) => setNewJobTitle(e.target.value)}
              />
              <div className="flex gap-3">
                <Button variant="ghost" className="flex-1" onClick={() => setIsCreatingJob(false)}>Cancel</Button>
                <Button variant="neon" className="flex-1" onClick={handleCreateJob}>Create Job</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

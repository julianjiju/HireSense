import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, Sparkles, Brain, X, Zap, Target, Users,
  Award, Plus, Briefcase, LayoutDashboard, AlertCircle, Eye
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { api } from '../services/api';
import type { JobRole, Candidate, UploadResult } from '../services/api';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'ranking'>('overview');
  const [jobs, setJobs] = useState<JobRole[]>([]);
  const [activeJob, setActiveJob] = useState<JobRole | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobDescription, setNewJobDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [files, setFiles] = useState<{file: File, status: 'queued' | 'parsing' | 'done' | 'failed', error?: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState('');

  // 1. Fetch Job Roles
  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.getJobRoles();
      setJobs(data);
    } catch (err) {
      setError("Backend connection failed. Ensure server is running on port 8000.");
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // 2. Fetch Rankings when active job changes
  useEffect(() => {
    if (activeJob) {
      api.getRankings(activeJob.id).then(data => {
        setCandidates(data.candidates);
      });
    }
  }, [activeJob]);

  // 3. Job Creation
  const handleCreateJob = async () => {
    if (!newJobTitle.trim() || !newJobDescription.trim()) return;
    setIsLoading(true);
    try {
      const data = await api.createJobRole(newJobTitle, newJobDescription);
      setJobs(prev => [data, ...prev]);
      setActiveJob(data);
      setIsCreatingJob(false);
      setNewJobTitle('');
      setNewJobDescription('');
    } catch (err) {
      setError("Failed to create job role");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteJobRole(id);
      setJobs(prev => prev.filter(j => j.id !== id));
      if (activeJob?.id === id) setActiveJob(null);
    } catch (err) {
      setError("Failed to delete job role");
    }
  };

  // 4. File Upload
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
    try {
      const queuedFiles = files.filter(f => f.status === 'queued').map(f => f.file);
      if (queuedFiles.length === 0) return;

      setFiles(prev => prev.map(f => f.status === 'queued' ? { ...f, status: 'parsing' } : f));
      
      const results = await api.uploadResumes(activeJob.id, queuedFiles);
      
      setFiles(prev => {
        const newFiles = [...prev];
        results.forEach(res => {
          const idx = newFiles.findIndex(f => f.file.name === res.filename && f.status === 'parsing');
          if (idx !== -1) {
            newFiles[idx] = { 
              ...newFiles[idx], 
              status: res.status === 'success' ? 'done' : 'failed',
              error: res.error 
            };
          }
        });
        return newFiles;
      });
      
      await fetchJobs(); // Update resume count
    } catch (err) {
      setError("Batch upload failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRank = async () => {
    if (!activeJob) return;
    setIsProcessing(true);
    try {
      const data = await api.rankCandidates(activeJob.id);
      setCandidates(data.candidates);
      setActiveTab('ranking');
    } catch (err) {
      setError("Claude AI Ranking failed. Check API logs.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-80 bg-[#0b1120] border-r border-white/5 flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-xl shadow-lg">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">HireSense</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          <nav className="space-y-1">
            <button onClick={() => { setActiveTab('overview'); setActiveJob(null); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${activeTab === 'overview' && !activeJob ? 'bg-white/5 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard Overview
            </button>
          </nav>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Job Roles</h3>
              <button onClick={() => setIsCreatingJob(true)} className="p-1 hover:bg-white/5 rounded-md text-indigo-400 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-1">
              {jobs.map(job => (
                <div key={job.id} onClick={() => { setActiveJob(job); setActiveTab('overview'); }}
                  className={`w-full group px-3 py-3 rounded-xl text-sm flex items-center gap-3 cursor-pointer transition-all ${activeJob?.id === job.id ? 'bg-indigo-500/10 border border-indigo-500/20' : 'hover:bg-white/5 border border-transparent'}`}>
                  <div className={`p-2 rounded-lg ${activeJob?.id === job.id ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 group-hover:text-slate-200'}`}>
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold truncate ${activeJob?.id === job.id ? 'text-white' : 'text-slate-300'}`}>{job.title}</p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{job.resume_count} Resumes</p>
                  </div>
                  <button onClick={(e) => handleDeleteJob(job.id, e)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-400 transition-all">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-black/20">
          <div className="bg-white/[0.02] rounded-xl p-4 text-center border border-white/5">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2 font-bold">System Status</p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <span className="text-xs font-semibold text-slate-300">FastAPI Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 shrink-0 bg-[#0b1120]/50 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-4">
            {activeJob ? (
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{activeJob.title}</h2>
                <span className="text-slate-600">/</span>
                <span className="text-xs text-slate-400 font-medium">Created {new Date(activeJob.created_at).toLocaleDateString()}</span>
              </div>
            ) : (
              <h2 className="text-lg font-bold text-slate-400 italic">Select a Job Role</h2>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {error && <span className="text-[10px] text-red-400 bg-red-400/10 px-3 py-1.5 rounded-full font-bold animate-pulse flex items-center gap-2"><AlertCircle className="w-3 h-3"/> {error}</span>}
            <Button variant="ghost" size="sm" onClick={() => setActiveTab('upload')} disabled={!activeJob}>Upload</Button>
            <Button variant="neon" size="sm" onClick={handleRank} disabled={!activeJob || isProcessing}>
              {isProcessing ? "Ranking..." : "AI Rank"}
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 relative">
          <AnimatePresence mode="wait">
            {!activeJob && activeTab === 'overview' ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-24 h-24 bg-indigo-500/10 rounded-[32px] flex items-center justify-center mb-8 shadow-inner">
                  <Target className="w-12 h-12 text-indigo-400" />
                </div>
                <h3 className="text-3xl font-black text-white mb-4">HireSense AI</h3>
                <p className="text-slate-500 max-w-md mb-10 text-lg">Your intelligent candidate ranking assistant. Start by creating a job role to analyze incoming talent.</p>
                <Button variant="neon" size="lg" onClick={() => setIsCreatingJob(true)}>Create First Job Role</Button>
              </motion.div>
            ) : activeJob && activeTab === 'overview' ? (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="md:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-8">
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <Badge className="mb-3 bg-indigo-500/20 text-indigo-300 border-none capitalize">{activeJob.title}</Badge>
                          <h3 className="text-2xl font-bold text-white">Requirement Analysis</h3>
                        </div>
                        <Users className="w-6 h-6 text-slate-600" />
                      </div>
                      <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap mb-8 bg-black/20 p-6 rounded-2xl border border-white/5">
                        {activeJob.description}
                      </p>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Applicants</span>
                          <span className="text-xl font-bold text-white">{activeJob.resume_count}</span>
                        </div>
                        <div className="w-px h-10 bg-white/5" />
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Created</span>
                          <span className="text-xl font-bold text-white">{new Date(activeJob.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                   </div>

                   <div className="space-y-6">
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4">
                          <Award className="w-5 h-5 text-emerald-400" />
                        </div>
                        <h4 className="text-2xl font-bold text-white">
                          {candidates.filter(c => c.match.match_score >= 80).length}
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">Strong Hire Recommendations</p>
                      </div>
                      
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-6">
                        <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center mb-4">
                          <Zap className="w-5 h-5 text-amber-400" />
                        </div>
                        <h4 className="text-2xl font-bold text-white">
                          {candidates.length > 0 ? (candidates.reduce((a,b) => a + b.match.match_score, 0) / candidates.length).toFixed(0) : 0}%
                        </h4>
                        <p className="text-xs text-slate-400 font-medium">Average Pool Score</p>
                      </div>
                   </div>
                </div>

                <div className="flex justify-center pt-8 border-t border-white/5">
                  <div className="flex gap-4">
                     <Button variant="ghost" size="lg" onClick={() => setActiveTab('upload')}>Upload Resumes</Button>
                     <Button variant="neon" size="lg" onClick={handleRank} disabled={activeJob.resume_count === 0 || isProcessing}>
                       {isProcessing ? "Analyzing with AI..." : "Begin AI Ranking"}
                     </Button>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'upload' ? (
              <motion.div key="upload" className="space-y-6 max-w-4xl mx-auto">
                <div {...getRootProps()} className={`border-2 border-dashed rounded-[40px] p-24 text-center transition-all cursor-pointer ${isDragActive ? 'border-indigo-500 bg-indigo-500/5' : 'border-white/5 hover:border-white/20 bg-white/[0.01]'}`}>
                  <input {...getInputProps()} />
                  <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <UploadCloud className="w-10 h-10 text-indigo-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Bulk Resume Ingestion</h3>
                  <p className="text-slate-500 text-sm">Drag and drop PDFs, Word docs, or Images</p>
                </div>

                {files.length > 0 && (
                  <div className="bg-[#0b1120] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Processing Queue</h4>
                      <Button variant="neon" size="sm" onClick={uploadFiles} disabled={isProcessing}>Start Processing</Button>
                    </div>
                    <div className="p-2 space-y-1">
                      {files.map((fileItem, i) => (
                        <div key={i} className="flex items-center justify-between p-4 hover:bg-white/[0.02] rounded-2xl transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="p-2 bg-white/5 rounded-lg text-slate-400">
                              <Eye className="w-4 h-4" />
                            </div>
                            <span className="text-sm font-medium text-slate-300 truncate w-80">{fileItem.file.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                             {fileItem.status === 'parsing' && <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />}
                             <Badge variant={fileItem.status === 'done' ? 'success' : fileItem.status === 'failed' ? 'destructive' : 'outline'} className="text-[9px] uppercase font-black px-3">
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
              <motion.div key="ranking" className="space-y-8 pb-32">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white">AI Candidate Matrix</h3>
                    <p className="text-sm text-slate-500 mt-1">Semantic match analysis using Claude 3.5 Sonnet</p>
                  </div>
                  <Button variant="outline" size="sm">Export Report</Button>
                </div>

                {candidates.length === 0 ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-32 text-center">
                    <Target className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500">No rankings generated yet for this role.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {candidates.map((c, idx) => (
                      <div key={c.resume_id} className="bg-white/[0.02] border border-white/5 p-6 rounded-3xl hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-500/20 group-hover:bg-indigo-500 transition-all" />
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-6">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-xl font-black text-slate-300 border border-white/10 shrink-0">
                              #{idx + 1}
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-white mb-1 group-hover:text-indigo-300 transition-colors uppercase tracking-tight">{c.candidate_name}</h4>
                              <p className="text-xs text-slate-500 mb-4 max-w-xl leading-relaxed italic line-clamp-2">"{c.match.reasoning}"</p>
                              
                              <div className="flex flex-wrap gap-2">
                                {c.match.missing_skills?.slice(0, 3).map(s => (
                                  <Badge key={s} variant="outline" className="text-[9px] border-red-500/20 text-red-300 bg-red-500/5">Missing {s}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right flex flex-col items-end">
                            <div className="text-4xl font-black text-white mb-1 flex items-baseline gap-1">
                              {c.match.match_score}<span className="text-sm text-slate-600">%</span>
                            </div>
                            <Badge variant={c.match.match_score >= 80 ? 'neon' : c.match.match_score >= 60 ? 'outline' : 'destructive'} className="text-[9px] px-3 py-1">
                              {c.match.recommendation}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
              className="bg-[#0b1120] border border-white/10 rounded-[40px] p-10 w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-white">New Job Role</h3>
                <button onClick={() => setIsCreatingJob(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 block">Job Title</label>
                  <input 
                    autoFocus
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all font-semibold placeholder:text-slate-700"
                    placeholder="e.g. Senior Backend Architect"
                    value={newJobTitle}
                    onChange={(e) => setNewJobTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3 block">Job Description</label>
                  <textarea 
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all min-h-[160px] resize-none text-sm leading-relaxed placeholder:text-slate-700"
                    placeholder="Detailed requirements, tech stack, and responsibilities..."
                    value={newJobDescription}
                    onChange={(e) => setNewJobDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-10">
                <Button variant="ghost" className="flex-1 h-14 rounded-2xl border border-white/5" onClick={() => setIsCreatingJob(false)}>Cancel</Button>
                <Button variant="neon" className="flex-1 h-14 rounded-2xl shadow-lg shadow-indigo-500/20" onClick={handleCreateJob} disabled={isLoading || !newJobTitle.trim() || !newJobDescription.trim()}>
                  {isLoading ? "Creating..." : "Save Role"}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

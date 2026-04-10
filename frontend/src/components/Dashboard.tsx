import { useState, useEffect, useCallback, useMemo, type MouseEvent } from 'react';

import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, Brain, X, Zap, Target, Users,
  Award, Plus, Briefcase, LayoutDashboard, AlertCircle, Eye, FileText,
  CheckCircle, GraduationCap, ExternalLink,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { api } from '../services/api';
import type { JobRole, Candidate, ResumeListItem } from '../services/types';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function displayNameForCandidate(c: Candidate): string {
  const n = (c.candidate_name || '').trim();
  if (
    n.length >= 2 &&
    !/^(resume|cv|document|candidate|unknown|profile|my resume|n\/a|none|na)$/i.test(n)
  ) {
    return n;
  }
  const stem = (c.filename || '').replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim();
  if (stem.length >= 2 && !/^(resume|cv|document)$/i.test(stem)) {
    return stem
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return 'Candidate';
}

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
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [error, setError] = useState('');
  const [batchLabel, setBatchLabel] = useState('');
  const [jobResumes, setJobResumes] = useState<ResumeListItem[]>([]);
  const [topTalentByJob, setTopTalentByJob] = useState<Record<string, Candidate[]>>({});
  const [minYearsFilter, setMinYearsFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [justificationFilter, setJustificationFilter] = useState('');
  const [resumePreview, setResumePreview] = useState<{ text: string; loading: boolean; error: string }>({
    text: '',
    loading: false,
    error: '',
  });
  const [resumePreviewOpen, setResumePreviewOpen] = useState(true);

  const getSkillBars = (skills: string[] = []) => {
    // Deterministic weighting by rank/order to visualize strongest inferred skills.
    const top = skills.slice(0, 8);
    return top.map((skill, idx) => ({
      skill,
      value: Math.max(25, 100 - idx * 10),
    }));
  };

  const getSkillsMatchedDisplay = (c: Candidate): string => {
    const skillText = c.match?.skill_match_analysis ?? '';
    const fromAnalysis = skillText.match(/(\d+)\s*(?:of|\/)\s*(\d+)/i);
    if (fromAnalysis) return `${fromAnalysis[1]}/${fromAnalysis[2]}`;
    const top = c.top_skills?.length ?? 0;
    const miss = c.match?.missing_skills?.length ?? 0;
    const denom = top + miss;
    if (denom > 0) return `${top}/${denom}`;
    return top > 0 ? `${top}` : '—';
  };

  const getFitSummaryNarrative = (c: Candidate): string => {
    return (
      c.match?.fit_summary_2_sentences?.trim() ||
      c.match?.reasoning?.trim() ||
      'No summary available.'
    );
  };

  const uploadErrorMessage = (code?: string) => {
    const map: Record<string, string> = {
      unsupported_format: 'Unsupported file type. Use PDF, DOCX, JPG, or PNG.',
      corrupt_or_empty: 'File empty or unreadable.',
      corrupt_or_invalid_pdf: 'PDF appears corrupt or invalid.',
      corrupt_or_invalid_image: 'Image appears corrupt or invalid.',
      corrupt_or_invalid_docx: 'Word file appears corrupt or invalid.',
      legacy_doc_not_supported: 'Legacy .doc is not supported — save as .docx.',
      file_too_large: 'File exceeds maximum upload size.',
      extraction_failed_or_empty: 'Text extraction failed or produced very little content.',
      extraction_failed: 'Could not extract text from this file.',
    };
    if (!code) return 'Upload failed';
    return map[code] || code;
  };

  const getEducationInsight = (c: Candidate): string => {
    const exp = c.experience_sections;
    const fromReasoning = (c.match?.reasoning ?? '').toLowerCase();
    const eduHint =
      /\b(degree|university|college|bachelor|master|mba|ph\.?d|diploma|certified)\b/i.test(fromReasoning);
    const parts: string[] = [];
    const extracted = c.education?.trim();
    if (extracted) parts.push(extracted);
    if (exp?.certifications) parts.push('Certifications or credentials are called out on the resume.');
    if (exp?.academic_projects) parts.push('Academic or project-based experience is present.');
    if (exp?.professional_experience) parts.push('Professional experience blocks are structured and visible.');
    if (exp?.education_section) parts.push('A dedicated education or qualifications section appears in the parsed resume.');
    if (eduHint) parts.push('Education-related signals appear in the holistic assessment text.');
    if (!parts.length) {
      parts.push(
        'No dedicated education section was auto-flagged; confirm credentials directly on the source resume if needed.'
      );
    }
    return parts.join(' ');
  };

  // 1. Fetch Job Roles
  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.getJobRoles();
      setJobs(data);
      
      // Update activeJob if it's currently selected to refresh the applicant count
      setActiveJob((prev: JobRole | null) => {
        if (!prev) return null;
        return data.find(j => j.id === prev.id) || prev;
      });
    } catch (err) {
      setError("Backend connection failed. Ensure server is running on port 8000.");
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const withResumes = jobs.filter((j) => j.resume_count > 0);
      const entries = await Promise.all(
        withResumes.map(async (j) => {
          try {
            const data = await api.getRankings(j.id);
            const top = [...data.candidates].sort((a, b) => b.match.match_score - a.match.match_score).slice(0, 3);
            return [j.id, top] as const;
          } catch {
            return [j.id, []] as const;
          }
        })
      );
      if (!cancelled) setTopTalentByJob(Object.fromEntries(entries) as Record<string, Candidate[]>);
    })();
    return () => {
      cancelled = true;
    };
  }, [jobs]);

  useEffect(() => {
    if (activeTab === 'upload' && activeJob) {
      api.listResumes(activeJob.id).then(setJobResumes).catch(() => setJobResumes([]));
    }
  }, [activeTab, activeJob]);

  // 2. Fetch Rankings when active job changes
  useEffect(() => {
    if (activeJob) {
      api.getRankings(activeJob.id).then(data => {
        setCandidates(data.candidates);
      });
    }
  }, [activeJob]);

  const filteredRankedCandidates = useMemo(() => {
    const minY = minYearsFilter.trim() === '' ? null : Number(minYearsFilter);
    const sk = skillFilter.trim().toLowerCase();
    const jus = justificationFilter.trim().toLowerCase();
    return candidates.filter((c) => {
      if (minY !== null && !Number.isNaN(minY) && (c.years_of_experience_number ?? 0) < minY) return false;
      if (sk && !(c.top_skills || []).join(' ').toLowerCase().includes(sk)) return false;
      if (jus) {
        const blob = `${c.match?.fit_summary_2_sentences || ''} ${c.match?.reasoning || ''}`.toLowerCase();
        if (!blob.includes(jus)) return false;
      }
      return true;
    });
  }, [candidates, minYearsFilter, skillFilter, justificationFilter]);

  const topThreeForActiveJob = useMemo(() => {
    if (!candidates.length) return [];
    return [...candidates].sort((a, b) => b.match.match_score - a.match.match_score).slice(0, 3);
  }, [candidates]);

  const resumeJobIdForPreview = selectedCandidate?.job_role_id ?? activeJob?.id;

  useEffect(() => {
    if (!selectedCandidate || !resumeJobIdForPreview) {
      setResumePreview({ text: '', loading: false, error: '' });
      return;
    }
    let cancelled = false;
    setResumePreview({ text: '', loading: true, error: '' });
    setResumePreviewOpen(true);
    api
      .getResumePreview(resumeJobIdForPreview, selectedCandidate.resume_id)
      .then((data) => {
        if (!cancelled) setResumePreview({ text: data.raw_text || '', loading: false, error: '' });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        let msg = 'Could not load resume text.';
        if (axios.isAxiosError(err)) {
          const st = err.response?.status;
          const detail = err.response?.data?.detail;
          if (st === 404) {
            msg =
              'Resume not found for this job. Re-run AI ranking or confirm the file is still in the library.';
          } else if (typeof detail === 'string') {
            msg = detail;
          } else if (!err.response) {
            msg =
              'Could not reach the API. If you use VITE_API_BASE_URL, set it to http://localhost:8000/api (include /api).';
          }
        }
        setResumePreview({ text: '', loading: false, error: msg });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCandidate?.resume_id, resumeJobIdForPreview]);

  const openResumeInNewWindow = async () => {
    if (!selectedCandidate) return;

    try {
      // 1. Try Native System Open first (for Windows/local usage)
      const res = await api.openResumeNative(selectedCandidate.resume_id);
      if (res.status === 'success') return; // Successfully started system viewer
    } catch (err) {
      // Fail silently and proceed to fallback
    }

    // 2. Fallback: Open extracted text in a new tab (for older uploads or non-local server)
    const displayName = displayNameForCandidate(selectedCandidate);
    const title = `${displayName} — Resume`;
    const safeName = escapeHtml(displayName);
    const safeFile = escapeHtml(selectedCandidate.filename);
    const safeBody = escapeHtml(resumePreview.text || '(No extracted text available for older resumes.)');
    
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>
      body{font-family:system-ui,-apple-system,sans-serif;padding:2rem;background:#0f172a;color:#e2e8f0;line-height:1.55;max-width:52rem;margin:0 auto;}
      h1{font-size:1.625rem;font-weight:800;margin:0 0 .35rem;color:#f8fafc;}
      .meta{opacity:.7;font-size:.8125rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid rgba(148,163,184,.25);}
      pre{white-space:pre-wrap;word-break:break-word;margin:0;font-size:.875rem;}
    </style></head><body><h1>${safeName}</h1><div class="meta">Original file: ${safeFile}</div><pre>${safeBody}</pre></body></html>`;
    
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const handleExportCSV = () => {
    if (!filteredRankedCandidates.length) return;
    const headers = ['Rank', 'Candidate Name', 'Score', 'Experience (Years)', 'Top Skills', 'AI Justification'];
    const rows = filteredRankedCandidates.map((c, idx) => [
      `#${idx + 1}`,
      c.candidate_name || 'Candidate',
      `${c.match?.match_score ?? 0}%`,
      c.years_of_experience_number ?? 0,
      (c.top_skills || []).join('; '),
      (c.match?.fit_summary_2_sentences || c.match?.reasoning || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `HireSense_Report_${activeJob?.title || 'Candidates'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  const handleDeleteJob = async (id: string, e: MouseEvent) => {
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
      const jobId = activeJob.id;
      const label = batchLabel || undefined;

      // Filter for files that need processing
      const toProcess = files.filter(f => f.status === 'queued' || f.status === 'failed');
      if (toProcess.length === 0) return;

      // State to track retries per filename
      const retryMap: Record<string, number> = {};
      const MAX_RETRIES = 3;

      // Sliding window queue implementation
      const queue = [...toProcess];
      
      const processOne = async () => {
        if (queue.length === 0) return;
        const item = queue.shift()!;
        const filename = item.file.name;
        const attempts = retryMap[filename] || 0;

        try {
          setFiles(prev => prev.map(f => 
            f.file.name === filename ? { ...f, status: 'parsing', error: attempts > 0 ? `Retrying (Attempt ${attempts})...` : undefined } : f
          ));

          const results = await api.uploadResumes(jobId, [item.file], label);
          const res = results[0];

          if (res.status === 'success') {
            setFiles(prev => prev.map(f => 
              f.file.name === filename ? { ...f, status: 'done', error: undefined } : f
            ));
          } else {
            throw new Error(res.error_code || 'backend_fail');
          }
        } catch (err) {
          const nextAttempt = attempts + 1;
          if (nextAttempt <= MAX_RETRIES) {
            retryMap[filename] = nextAttempt;
            // Move failing item to the END of the queue as requested
            queue.push(item);
            setFiles(prev => prev.map(f => 
              f.file.name === filename ? { ...f, status: 'failed', error: 'Timed out. Moving to end of line...' } : f
            ));
          } else {
            setFiles(prev => prev.map(f => 
              f.file.name === filename ? { ...f, status: 'failed', error: 'Failed after multiple attempts.' } : f
            ));
          }
        } finally {
          // Periodic list refresh
          fetchJobs();
          api.listResumes(jobId).then(setJobResumes).catch(() => {});
          
          // Continue processing next item if queue isn't empty
          if (queue.length > 0) await processOne();
        }
      };

      // Start multiple parallel processors (concurrency 5)
      const CONCURRENCY = 5;
      const workers = Array(Math.min(CONCURRENCY, toProcess.length)).fill(null).map(() => processOne());
      await Promise.all(workers);

    } catch (err) {
      setError('Critical uploader error.');
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
      const top = [...data.candidates]
        .sort((a, b) => b.match.match_score - a.match.match_score)
        .slice(0, 3);
      setTopTalentByJob((prev) => ({ ...prev, [activeJob.id]: top }));
      setActiveTab('ranking');
    } catch (err) {
      setError("AI Ranking failed. Check backend logs for details.");
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
              jobs.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col items-center justify-center text-center">
                  <div className="w-24 h-24 bg-indigo-500/10 rounded-[32px] flex items-center justify-center mb-8 shadow-inner">
                    <Target className="w-12 h-12 text-indigo-400" />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-4">HireSense AI</h3>
                  <p className="text-slate-500 max-w-md mb-10 text-lg">Your intelligent candidate ranking assistant. Start by creating a job role to analyze incoming talent.</p>
                  <Button variant="neon" size="lg" onClick={() => setIsCreatingJob(true)}>Create First Job Role</Button>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
                  <div className="text-center">
                    <h3 className="text-2xl font-black text-white mb-2">Recruiter dashboard</h3>
                    <p className="text-slate-500 text-sm">Select a job role in the sidebar to view requirements, upload resumes, and run AI ranking.</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Top talent preview (all roles)</h4>
                    <div className="space-y-3">
                      {jobs.map((j) => {
                        const top = topTalentByJob[j.id] || [];
                        if (j.resume_count === 0) {
                          return (
                            <div key={j.id} className="flex justify-between items-center py-2 border-b border-white/5 text-sm text-slate-500">
                              <span className="text-slate-300 font-medium">{j.title}</span>
                              <span>No resumes yet</span>
                            </div>
                          );
                        }
                        return (
                          <div
                            key={j.id}
                            className="rounded-xl border border-white/5 bg-black/20 p-4 cursor-pointer hover:border-indigo-500/30 transition-colors"
                            onClick={() => { setActiveJob(j); setActiveTab('ranking'); }}
                          >
                            <div className="flex justify-between items-start gap-4">
                              <div>
                                <p className="font-semibold text-white">{j.title}</p>
                                <p className="text-[11px] text-slate-500 mt-1">{j.resume_count} resumes in pool</p>
                              </div>
                              {top[0] && (
                                <Badge variant="neon" className="shrink-0">{top[0].match.match_score}% lead</Badge>
                              )}
                            </div>
                            {top.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {top.slice(0, 3).map((c) => (
                                  <span key={c.resume_id} className="text-[11px] text-slate-400 bg-white/5 px-2 py-1 rounded-lg">
                                    {c.candidate_name} · {c.match.match_score}%
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 mt-2">Run AI ranking to see ranked candidates.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              )
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

                {topThreeForActiveJob.length > 0 && (
                  <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Top talent preview</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {topThreeForActiveJob.map((c, i) => (
                        <button
                          type="button"
                          key={c.resume_id}
                          onClick={() => setSelectedCandidate(c)}
                          className="text-left rounded-2xl bg-black/30 border border-white/5 p-4 hover:border-indigo-500/25 transition-colors"
                        >
                          <p className="text-[10px] text-slate-500 font-bold">#{i + 1}</p>
                          <p className="font-bold text-white mt-1">{c.candidate_name}</p>
                          <p className="text-lg font-black text-indigo-300 mt-2">{c.match.match_score}%</p>
                          <p className="text-xs text-slate-400 mt-2 line-clamp-3 leading-relaxed">
                            {c.match.fit_summary_2_sentences || c.match.reasoning || '—'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Upload batch label (optional)</label>
                  <input
                    className="mt-2 w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Campus Feb 2026 · REQ-1042"
                    value={batchLabel}
                    onChange={(e) => setBatchLabel(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    Groups files under one recruiter-facing batch for this job role. Each file still stores its upload timestamp for sorting.
                  </p>
                </div>
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
                          {fileItem.error && (
                            <p className="text-[11px] text-red-300/90 mt-2 pl-14">{fileItem.error}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeJob && jobResumes.length > 0 && (
                  <div className="bg-[#0b1120] border border-white/5 rounded-3xl overflow-hidden">
                    <div className="p-6 border-b border-white/5">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Resume library (by batch & date)</h4>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
                      {jobResumes.map((r) => (
                        <div key={r.id} className="px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="text-slate-300 truncate max-w-[200px]" title={r.filename}>{r.filename}</span>
                          <span className="text-[11px] text-slate-500">
                            {r.batch_label ? <Badge variant="outline" className="text-[9px] mr-2">{r.batch_label}</Badge> : null}
                            {r.upload_date ? new Date(r.upload_date).toLocaleString() : ''}
                          </span>
                          <span className="text-[11px] text-slate-400">{r.candidate_name_preview}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="ranking" className="space-y-6 pb-32">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-white">Ranking view</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Weighted compatibility scoring (depth-of-experience + semantic fit). Click a row for the full resume preview.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!filteredRankedCandidates.length}>
                    Export Report
                  </Button>
                </div>

                {candidates.length === 0 ? (
                  <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-32 text-center">
                    <Target className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500">No rankings generated yet for this role.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap gap-4 items-end rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Min years</label>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          className="w-28 bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                          value={minYearsFilter}
                          onChange={(e) => setMinYearsFilter(e.target.value)}
                        />
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">Top skills contains</label>
                        <input
                          className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                          placeholder="e.g. react, java"
                          value={skillFilter}
                          onChange={(e) => setSkillFilter(e.target.value)}
                        />
                      </div>
                      <div className="flex-1 min-w-[180px]">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">AI justification contains</label>
                        <input
                          className="w-full bg-[#020617] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                          placeholder="Search summary / reasoning"
                          value={justificationFilter}
                          onChange={(e) => setJustificationFilter(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-white/5 bg-[#0b1120]/80">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.04] text-[10px] uppercase tracking-wider text-slate-400">
                            <th className="px-4 py-3 font-semibold">Rank</th>
                            <th className="px-4 py-3 font-semibold">Candidate</th>
                            <th className="px-4 py-3 font-semibold">Years</th>
                            <th className="px-4 py-3 font-semibold">Top skills</th>
                            <th className="px-4 py-3 font-semibold min-w-[260px]">AI justification</th>
                            <th className="px-4 py-3 font-semibold">Score</th>
                            <th className="px-4 py-3 font-semibold">Recommendation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRankedCandidates.map((c, idx) => (
                            <tr
                              key={c.resume_id}
                              onClick={() => setSelectedCandidate(c)}
                              className="border-b border-white/5 cursor-pointer hover:bg-white/[0.04] transition-colors"
                            >
                              <td className="px-4 py-3 text-slate-500 font-mono text-xs">#{idx + 1}</td>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-white">{c.candidate_name || 'Candidate'}</p>
                                <p className="text-[11px] text-slate-500 truncate max-w-[180px]" title={c.filename}>{c.filename}</p>
                              </td>
                              <td className="px-4 py-3 text-slate-200 tabular-nums">{c.years_of_experience_number ?? 0}</td>
                              <td className="px-4 py-3 text-slate-300 max-w-[200px]">
                                <span className="line-clamp-2">{(c.top_skills || []).slice(0, 6).join(', ') || '—'}</span>
                              </td>
                              <td className="px-4 py-3 text-slate-400 max-w-md">
                                <span className="line-clamp-2 leading-relaxed">
                                  {c.match?.fit_summary_2_sentences || c.match?.reasoning || '—'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="font-bold text-indigo-300 tabular-nums">{c.match?.match_score ?? 0}%</span>
                                {c.match?.semantic_match_score != null && c.match.semantic_match_score !== c.match.match_score && (
                                  <span className="block text-[10px] text-slate-500">AI raw {c.match.semantic_match_score}%</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={(c.match?.match_score || 0) >= 80 ? 'neon' : (c.match?.match_score || 0) >= 60 ? 'outline' : 'destructive'} className="text-[9px]">
                                  {c.match?.recommendation || 'Maybe'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-slate-500">
                      Showing {filteredRankedCandidates.length} of {candidates.length} candidates (filters apply to this table).
                    </p>
                  </>
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

      {/* Candidate Detail Preview */}
      <AnimatePresence>
        {selectedCandidate && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-xl bg-black/60">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0b1120] border border-white/10 rounded-[32px] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            >
              <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/10 bg-[#0b1120] flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/90 mb-1">Candidate</p>
                  <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight break-words">
                    {displayNameForCandidate(selectedCandidate)}
                  </h3>
                  {activeJob && (
                    <p className="text-sm text-slate-400 mt-2">
                      Role: <span className="text-slate-200 font-medium">{activeJob.title}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-2 truncate font-mono" title={selectedCandidate.filename}>
                    Source file · {selectedCandidate.filename}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedCandidate(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6 space-y-6 [scrollbar-width:thin] [scrollbar-color:rgba(100,116,139,0.55)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/55 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500/70"
              >
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" /> Resume preview
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                        Full extracted text from the upload. Open in a new tab for printing or side-by-side review.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <Button variant="outline" size="sm" type="button" onClick={() => setResumePreviewOpen((o) => !o)}>
                        {resumePreviewOpen ? 'Collapse' : 'Expand'}
                      </Button>
                      <Button
                        variant="neon"
                        size="sm"
                        type="button"
                        disabled={!resumePreview.text || resumePreview.loading}
                        onClick={openResumeInNewWindow}
                        className="gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open resume
                      </Button>
                    </div>
                  </div>
                  {!resumeJobIdForPreview && (
                    <p className="text-xs text-amber-400/90">Select this job in the sidebar to load saved resume text.</p>
                  )}
                  {resumeJobIdForPreview && resumePreview.loading && (
                    <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                      <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                      Loading resume…
                    </div>
                  )}
                  {resumePreview.error && <p className="text-sm text-red-400">{resumePreview.error}</p>}
                  {resumePreviewOpen && !resumePreview.loading && resumePreview.text && (
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-white/5 bg-black/30 p-4">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{resumePreview.text}</pre>
                    </div>
                  )}
                  {resumePreviewOpen && !resumePreview.loading && !resumePreview.text && !resumePreview.error && resumeJobIdForPreview && (
                    <p className="text-xs text-slate-500">No extracted text is stored for this file.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Compatibility score</p>
                    <p className="text-3xl font-black text-white mt-2">{selectedCandidate.match?.match_score ?? 0}%</p>
                    {selectedCandidate.match?.semantic_match_score != null && (
                      <p className="text-[10px] text-slate-500 mt-1">Semantic (AI) {selectedCandidate.match.semantic_match_score}%</p>
                    )}
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Experience</p>
                    <p className="text-3xl font-black text-white mt-2">{selectedCandidate.years_of_experience_number ?? 0}y</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Recommendation</p>
                    <p className="text-sm font-bold text-indigo-300 mt-3">{selectedCandidate.match?.recommendation || 'Maybe'}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Profile Coverage</p>
                    <div className="mt-2 text-xs text-slate-300 space-y-1">
                      <p>Professional: {selectedCandidate.experience_sections?.professional_experience ? 'Yes' : 'No'}</p>
                      <p>Projects: {selectedCandidate.experience_sections?.academic_projects ? 'Yes' : 'No'}</p>
                      <p>Certifications: {selectedCandidate.experience_sections?.certifications ? 'Yes' : 'No'}</p>
                      <p>Education block: {selectedCandidate.experience_sections?.education_section ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                </div>

                {/* AI Fit Summary — premium insight card */}
                <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                      <Brain className="h-4 w-4 text-cyan-300" />
                    </div>
                    <h4 className="text-sm font-semibold text-white tracking-tight">AI Fit Summary</h4>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <p className="text-slate-300">
                      Score:{' '}
                      <span className="font-semibold text-blue-400">
                        {selectedCandidate.match?.match_score ?? 0}%
                      </span>
                    </p>
                    <p className="text-slate-300">
                      Recommendation:{' '}
                      <span className="font-semibold text-cyan-300">
                        {selectedCandidate.match?.recommendation || 'Maybe'}
                      </span>
                    </p>
                    <p className="text-slate-300">
                      Skills matched:{' '}
                      <span className="font-semibold text-white">
                        {getSkillsMatchedDisplay(selectedCandidate)}
                      </span>
                    </p>
                  </div>

                  <p className="text-sm text-slate-400 leading-relaxed border-t border-white/10 pt-3">
                    {getFitSummaryNarrative(selectedCandidate)}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" /> Top Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.top_skills?.length ? selectedCandidate.top_skills.map((skill: string) => (
                        <Badge key={skill} variant="outline" className="text-[10px] border-indigo-500/20 text-indigo-300 bg-indigo-500/5">
                          {skill}
                        </Badge>
                      )) : <p className="text-xs text-slate-500">No skills extracted.</p>}
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Missing Skills</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedCandidate.match?.missing_skills?.length ? selectedCandidate.match.missing_skills.map((s: string) => (
                        <Badge key={s} variant="outline" className="text-[10px] border-red-500/20 text-red-300 bg-red-500/5">
                          {s}
                        </Badge>
                      )) : <p className="text-xs text-slate-500">No key gaps detected.</p>}
                    </div>
                  </div>
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4">Skill Strength Graph</p>
                  <div className="space-y-3">
                    {getSkillBars(selectedCandidate.top_skills).length ? getSkillBars(selectedCandidate.top_skills).map(({ skill, value }) => (
                      <div key={skill} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{skill}</span>
                          <span className="text-slate-500">{value}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                            style={{ width: `${value}%` }}
                          />
                        </div>
                      </div>
                    )) : <p className="text-xs text-slate-500">No skill graph available.</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Skill Match Analysis</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{selectedCandidate.match?.skill_match_analysis || 'N/A'}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3">Experience Match Analysis</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{selectedCandidate.match?.experience_match_analysis || 'N/A'}</p>
                  </div>
                </div>

                {/* Detailed Reasoning — structured insight card (full content retained) */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    <h4 className="text-sm font-semibold text-white">Detailed Reasoning</h4>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1 flex items-center gap-1.5">
                        <Brain className="h-3.5 w-3.5 text-slate-400 shrink-0" /> Skill analysis
                      </p>
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {selectedCandidate.match?.skill_match_analysis?.trim() || 'No skill analysis returned.'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1 flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" /> Experience analysis
                      </p>
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {selectedCandidate.match?.experience_match_analysis?.trim() || 'No experience analysis returned.'}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1 flex items-center gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-slate-400" /> Education
                      </p>
                      <p className="text-sm text-slate-200 leading-relaxed">{getEducationInsight(selectedCandidate)}</p>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3 space-y-2">
                    <p className="text-xs text-slate-400 uppercase tracking-wide font-medium flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-400/90" /> Full narrative
                    </p>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {selectedCandidate.match?.reasoning?.trim() || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

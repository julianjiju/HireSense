import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, Sparkles, BarChart3, AlertCircle, Brain,
  ChevronRight, Eye, X, Zap, Target, TrendingUp, Users, Shield,
  Award, AlertTriangle, CheckCircle2, XCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import axios from 'axios';

const API_URL = 'http://localhost:5000';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  candidate_name: string;
  skills: string[];
  seniority_level: string;
  domain: string;
  short_summary: string;
  key_strengths: string[];
  education: string;
  years_of_experience: string;
  projects: string[];
  match_score: number;
  skill_match_analysis: string;
  experience_match_analysis: string;
  missing_skills: string[];
  strengths: string[];
  reasoning: string;
  recommendation: string;
  resume_text: string;
}

interface Analytics {
  total_candidates: number;
  average_score: number;
  hiring_confidence: number;
  top_skills: string[];
  rare_skills: string[];
  missing_skills: string[];
  skill_coverage_score: number;
}

interface ParsedJD {
  role: string;
  required_skills: string[];
  required_experience: string;
  seniority_expectation: string;
}

// ─── Score Ring Component ────────────────────────────────────────────────────

function ScoreRing({ score, size = 80, stroke = 6 }: { score: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke}
          fill="none" stroke="rgba(255,255,255,0.05)" />
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke}
          fill="none" stroke={color} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="score-ring" style={{ filter: `drop-shadow(0 0 6px ${color}50)` }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-slate-100">{score}</span>
      </div>
    </div>
  );
}

// ─── Recommendation Badge ────────────────────────────────────────────────────

function RecBadge({ rec }: { rec: string }) {
  const lower = rec.toLowerCase();
  if (lower.includes('strong'))
    return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" />{rec}</Badge>;
  if (lower.includes('hire'))
    return <Badge variant="success" className="gap-1 opacity-80"><CheckCircle2 className="w-3 h-3" />{rec}</Badge>;
  if (lower.includes('maybe'))
    return <Badge variant="default" className="gap-1"><AlertTriangle className="w-3 h-3" />{rec}</Badge>;
  return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />{rec}</Badge>;
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'upload' | 'analyze'>('upload');

  const [files, setFiles] = useState<File[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [resumeIds, setResumeIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [bestCandidate, setBestCandidate] = useState<Candidate | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [parsedJD, setParsedJD] = useState<ParsedJD | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }
  });

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setError('');
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    try {
      const res = await axios.post(`${API_URL}/upload`, formData);
      const ids = res.data.resumes.map((r: any) => r.id);
      setResumeIds(prev => [...prev, ...ids]);
      setFiles([]);
      setActiveTab('analyze');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Upload failed. Is the backend running?');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) { setError('Job description is required.'); return; }
    setIsAnalyzing(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/rank`, {
        job_description: jobDescription,
        resume_ids: resumeIds,
      });
      setCandidates(res.data.candidates || []);
      setBestCandidate(res.data.best_candidate || null);
      setAnalytics(res.data.analytics || null);
      setParsedJD(res.data.parsed_jd || null);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Analysis failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-64 glass-strong flex flex-col hidden md:flex border-r border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center gap-3">
          <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-2 rounded-xl shadow-neon-cyan">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-white">HireSense</h1>
          <Badge variant="neon" className="text-[10px] ml-auto px-1.5 py-0">AI</Badge>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button onClick={() => setActiveTab('upload')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${activeTab === 'upload' ? 'bg-white/10 text-cyan-300 font-medium neon-border-cyan' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <UploadCloud className="w-4 h-4" /> Upload Resumes
          </button>
          <button onClick={() => setActiveTab('analyze')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${activeTab === 'analyze' ? 'bg-white/10 text-cyan-300 font-medium neon-border-cyan' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
            <BarChart3 className="w-4 h-4" /> Analyze & Rank
          </button>
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="glass-light rounded-xl p-3 text-center">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Powered by</p>
            <p className="text-xs font-semibold text-slate-300">Google Gemini AI</p>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <header className="glass-strong border-b border-white/5 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-white">
              {activeTab === 'upload' ? 'Upload Candidates' : 'AI Intelligence Dashboard'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'upload' ? 'Add resumes for AI processing' : 'Gemini-powered candidate analysis'}
            </p>
          </div>
          {resumeIds.length > 0 && (
            <Badge variant="outline" className="text-xs">{resumeIds.length} resumes in pool</Badge>
          )}
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full">
          {/* Error */}
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="mb-6 glass rounded-xl p-4 border border-red-500/20 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* ── UPLOAD TAB ──────────────────────────────────────── */}
            {activeTab === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-6">

                <div {...getRootProps()}
                  className={`glass rounded-3xl p-16 text-center transition-all duration-300 cursor-pointer group
                    ${isDragActive ? 'neon-border-cyan scale-[1.01]' : 'border border-white/5 hover:border-white/10'}`}>
                  <input {...getInputProps()} />
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 transition-all duration-300
                    ${isDragActive ? 'bg-cyan-500/20 shadow-neon-cyan' : 'bg-white/5 group-hover:bg-white/10'}`}>
                    <UploadCloud className={`w-10 h-10 transition-colors ${isDragActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Drop resumes here</h3>
                  <p className="text-slate-500 text-sm mb-6">PDF files • AI will extract structured data from each resume</p>
                  <Button variant="outline">Browse Files</Button>
                </div>

                {files.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="glass rounded-2xl p-6 border border-white/5">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4">Queued ({files.length})</h3>
                    <ul className="space-y-2 mb-6">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                          <span className="text-sm text-slate-300 truncate">{f.name}</span>
                          <span className="text-xs text-slate-600">{(f.size / 1024).toFixed(0)} KB</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end">
                      <Button variant="neon" size="lg" onClick={handleUpload} disabled={isUploading}>
                        {isUploading ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />AI Processing...</>
                        ) : (
                          <><Sparkles className="w-4 h-4 mr-2" />Upload & Analyze</>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── ANALYZE TAB ─────────────────────────────────────── */}
            {activeTab === 'analyze' && (
              <motion.div key="analyze" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }} className="space-y-8">

                {/* JD Input */}
                <div className="glass rounded-2xl overflow-hidden border border-white/5 focus-within:neon-border-blue transition-all duration-300">
                  <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-medium text-slate-300">Job Description</h3>
                  </div>
                  <textarea className="w-full h-28 p-6 bg-transparent resize-none focus:outline-none text-slate-200 placeholder-slate-600 text-sm"
                    placeholder="Paste the full job description here — AI will parse role, skills, experience, and seniority requirements..."
                    value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
                  <div className="px-6 py-4 border-t border-white/5 flex justify-between items-center">
                    <p className="text-xs text-slate-600">Gemini will analyze each candidate as a senior recruiter</p>
                    <Button variant="neon" onClick={handleAnalyze}
                      disabled={isAnalyzing || !jobDescription.trim() || resumeIds.length === 0}>
                      {isAnalyzing ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />AI Analyzing...</>
                      ) : (
                        <><Brain className="w-4 h-4 mr-2" />Rank with AI</>
                      )}
                    </Button>
                  </div>
                </div>

                {/* ── Analytics Cards ──────────────────────────────── */}
                {analytics && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    {[
                      { label: 'Candidates', value: analytics.total_candidates, icon: Users, color: 'text-blue-400' },
                      { label: 'Avg Score', value: `${analytics.average_score}%`, icon: TrendingUp, color: 'text-cyan-400' },
                      { label: 'Hire Confidence', value: `${analytics.hiring_confidence}%`, icon: Shield, color: 'text-purple-400' },
                      { label: 'Skill Coverage', value: `${analytics.skill_coverage_score}%`, icon: Target, color: 'text-green-400' },
                      { label: 'Role', value: parsedJD?.role || '—', icon: Zap, color: 'text-amber-400', wide: true },
                    ].map((stat, i) => (
                      <div key={i} className={`glass rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all ${(stat as any).wide ? 'col-span-2 lg:col-span-1' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{stat.label}</span>
                        </div>
                        <p className="text-lg font-bold text-white truncate">{stat.value}</p>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* ── Best Candidate Hero ──────────────────────────── */}
                {bestCandidate && (
                  <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
                    className="relative rounded-3xl overflow-hidden">
                    {/* Glow border effect */}
                    <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 animate-pulse-glow" />
                    <div className="relative glass-strong rounded-3xl p-8 m-[1px] border border-cyan-500/10">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-cyan-500/5 to-transparent rounded-bl-full" />

                      <div className="flex items-center gap-2 mb-6">
                        <Badge variant="neon" className="gap-1 animate-pulse-glow"><Award className="w-3 h-3" />BEST MATCH</Badge>
                        <RecBadge rec={bestCandidate.recommendation} />
                      </div>

                      <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-3xl font-extrabold text-white mb-1">{bestCandidate.candidate_name}</h3>
                          <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <Badge variant="outline">{bestCandidate.seniority_level}</Badge>
                            <Badge variant="outline">{bestCandidate.domain}</Badge>
                            {bestCandidate.years_of_experience && <Badge variant="outline">{bestCandidate.years_of_experience}</Badge>}
                          </div>
                          <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-2xl">{bestCandidate.reasoning}</p>

                          {/* Quick Insights */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                              <p className="text-[10px] text-slate-500 uppercase mb-1 font-semibold">Top Strengths</p>
                              <p className="text-xs text-slate-300">{bestCandidate.strengths.slice(0, 2).join(' • ')}</p>
                            </div>
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                              <p className="text-[10px] text-slate-500 uppercase mb-1 font-semibold">Skill Fit</p>
                              <p className="text-xs text-slate-300">{bestCandidate.skill_match_analysis.slice(0, 80)}…</p>
                            </div>
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                              <p className="text-[10px] text-slate-500 uppercase mb-1 font-semibold">Experience</p>
                              <p className="text-xs text-slate-300">{bestCandidate.experience_match_analysis.slice(0, 80)}…</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {bestCandidate.skills.slice(0, 8).map(s => (
                              <span key={s} className="px-2.5 py-1 text-xs rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">{s}</span>
                            ))}
                          </div>
                        </div>

                        {/* Score Section */}
                        <div className="flex flex-col items-center gap-4 shrink-0">
                          <ScoreRing score={bestCandidate.match_score} size={120} stroke={8} />
                          <Button variant="neon" size="sm" onClick={() => setSelectedCandidate(bestCandidate)}>
                            <Eye className="w-3 h-3 mr-1.5" />Deep Dive
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Candidate List ──────────────────────────────── */}
                {candidates.length > 1 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">All Candidates</h3>
                    {candidates.slice(1).map((c, idx) => (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + idx * 0.05 }}
                        className="glass rounded-2xl p-5 border border-white/5 hover:border-white/10 hover:shadow-glass transition-all duration-300 group">
                        <div className="flex flex-col lg:flex-row gap-5">
                          {/* Left */}
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <ScoreRing score={c.match_score} size={56} stroke={4} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="text-base font-bold text-white">{c.candidate_name}</h4>
                                <RecBadge rec={c.recommendation} />
                              </div>
                              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                <Badge variant="secondary" className="text-[10px]">{c.seniority_level}</Badge>
                                <Badge variant="secondary" className="text-[10px]">{c.domain}</Badge>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-2 mb-3">{c.short_summary}</p>

                              {/* At a glance */}
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 mb-3">
                                <span><span className="text-emerald-400">▲</span> {c.strengths[0] || '—'}</span>
                                {c.missing_skills[0] && <span><span className="text-red-400">▼</span> Missing: {c.missing_skills[0]}</span>}
                              </div>

                              <Button variant="ghost" size="sm" onClick={() => setSelectedCandidate(c)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye className="w-3 h-3 mr-1.5" />View Profile
                              </Button>
                            </div>
                          </div>

                          {/* Right — Score Bars */}
                          <div className="w-full lg:w-56 shrink-0 space-y-2.5 bg-white/[0.02] rounded-xl p-4 border border-white/5">
                            {[
                              { label: 'AI Match', value: c.match_score },
                              { label: 'Skill Fit', value: Math.min(100, Math.round((1 - c.missing_skills.length / Math.max(parsedJD?.required_skills?.length || 1, 1)) * 100)) },
                            ].map((bar, i) => (
                              <div key={i}>
                                <div className="flex justify-between text-[10px] font-semibold mb-1">
                                  <span className="text-slate-500">{bar.label}</span>
                                  <span className="text-slate-400">{bar.value}%</span>
                                </div>
                                <Progress value={bar.value} className="h-1" />
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* ── Skill Intelligence ──────────────────────────── */}
                {analytics && (analytics.top_skills.length > 0 || analytics.missing_skills.length > 0) && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass rounded-xl p-5 border border-white/5">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-cyan-400" /> Top Skills in Pool
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analytics.top_skills.slice(0, 10).map(s => (
                          <span key={s} className="px-2 py-1 text-[11px] rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/15">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="glass rounded-xl p-5 border border-white/5">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-purple-400" /> Rare Skills (High Value)
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analytics.rare_skills.length > 0 ? analytics.rare_skills.slice(0, 8).map(s => (
                          <span key={s} className="px-2 py-1 text-[11px] rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/15">{s}</span>
                        )) : <span className="text-xs text-slate-600">No rare skills detected</span>}
                      </div>
                    </div>
                    <div className="glass rounded-xl p-5 border border-white/5">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> Common Gaps
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analytics.missing_skills.length > 0 ? analytics.missing_skills.slice(0, 8).map(s => (
                          <span key={s} className="px-2 py-1 text-[11px] rounded-md bg-red-500/10 text-red-300 border border-red-500/15">{s}</span>
                        )) : <span className="text-xs text-slate-600">No major gaps</span>}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* ── Slide-in Resume Panel ──────────────────────────────── */}
      <AnimatePresence>
        {selectedCandidate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSelectedCandidate(null)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-0 right-0 h-full w-full max-w-2xl glass-strong z-50 shadow-2xl flex flex-col border-l border-white/5">

              {/* Panel Header */}
              <div className="p-6 border-b border-white/5 flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <ScoreRing score={selectedCandidate.match_score} size={64} stroke={5} />
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedCandidate.candidate_name}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <RecBadge rec={selectedCandidate.recommendation} />
                      <Badge variant="outline" className="text-[10px]">{selectedCandidate.seniority_level}</Badge>
                      <Badge variant="outline" className="text-[10px]">{selectedCandidate.domain}</Badge>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedCandidate(null)}
                  className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Panel Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* AI Reasoning */}
                <section className="glass-light rounded-xl p-5 neon-border-cyan">
                  <h4 className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" /> AI Recruiter Analysis
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed">{selectedCandidate.reasoning}</p>
                </section>

                {/* Skills & Experience */}
                <div className="grid grid-cols-2 gap-4">
                  <section>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Skill Analysis</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{selectedCandidate.skill_match_analysis}</p>
                  </section>
                  <section>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Experience Analysis</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{selectedCandidate.experience_match_analysis}</p>
                  </section>
                </div>

                {/* Strengths */}
                <section>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Key Strengths</h4>
                  <div className="space-y-1.5">
                    {selectedCandidate.strengths.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />{s}
                      </div>
                    ))}
                  </div>
                </section>

                {/* Skills */}
                <section>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Technical Skills</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCandidate.skills.map(s => (
                      <span key={s} className="px-2 py-1 text-[11px] rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/15">{s}</span>
                    ))}
                  </div>
                </section>

                {/* Missing Skills */}
                {selectedCandidate.missing_skills.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Missing Skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCandidate.missing_skills.map(s => (
                        <span key={s} className="px-2 py-1 text-[11px] rounded-md bg-red-500/10 text-red-300 border border-red-500/15">{s}</span>
                      ))}
                    </div>
                  </section>
                )}

                {/* Projects */}
                {selectedCandidate.projects.length > 0 && (
                  <section>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Projects</h4>
                    <ul className="space-y-1.5">
                      {selectedCandidate.projects.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                          <ChevronRight className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />{p}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Education */}
                <section>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Education</h4>
                  <p className="text-xs text-slate-400">{selectedCandidate.education || 'Not specified'}</p>
                </section>

                {/* Raw Resume */}
                <details className="group">
                  <summary className="text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-400 transition-colors flex items-center gap-1">
                    <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                    Raw Resume Text
                  </summary>
                  <div className="mt-3 bg-black/30 rounded-xl p-4 border border-white/5 max-h-96 overflow-y-auto">
                    <pre className="text-[11px] text-slate-500 whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedCandidate.resume_text}
                    </pre>
                  </div>
                </details>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

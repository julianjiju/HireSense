import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FileText, Sparkles, ChevronRight, BarChart3, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import axios from 'axios';

const API_URL = 'http://localhost:5000';

interface Candidate {
  id: string;
  candidate_name: string;
  final_score: number;
  semantic_score: number;
  skill_score: number;
  extracted_skills: string[];
  explanation: string;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'upload' | 'analyze'>('upload');
  
  // State
  const [files, setFiles] = useState<File[]>([]);
  const [jobDescription, setJobDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<Candidate[]>([]);
  const [resumeIds, setResumeIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  // Dropzone setup
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] } });

  const handleUpload = async () => {
    if (files.length === 0) return;
    setIsUploading(true);
    setError('');
    
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const res = await axios.post(`${API_URL}/upload`, formData);
      const newIds = res.data.resumes.map((r: any) => r.id);
      setResumeIds(prev => [...prev, ...newIds]);
      setFiles([]); // Clear local files after upload
      setActiveTab('analyze');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload resumes. Ensure the backend is running.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription) {
      setError('Job description is required.');
      return;
    }
    
    setIsAnalyzing(true);
    setError('');
    
    try {
      const res = await axios.post(`${API_URL}/rank`, {
        job_description: jobDescription,
        resume_ids: resumeIds
      });
      setResults(res.data.ranked_candidates || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to analyze candidates.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">HireSense</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('upload')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'upload' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <UploadCloud className="w-5 h-5" />
            Upload Resumes
          </button>
          <button 
            onClick={() => setActiveTab('analyze')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'analyze' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <BarChart3 className="w-5 h-5" />
            Analyze & Rank
          </button>
        </nav>
        
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
              R
            </div>
            <span>Recruiter Mode</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto relative">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900">
              {activeTab === 'upload' ? 'Upload Candidates' : 'Candidate Analysis'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === 'upload' ? 'Add resumes to the pool for AI processing.' : 'Smart candidate ranking using AI.'}
            </p>
          </div>
          {resumeIds.length > 0 && (
            <Badge variant="secondary" className="px-3 py-1">
              {resumeIds.length} Resumes in Pool
            </Badge>
          )}
        </header>

        <div className="p-8 max-w-5xl mx-auto w-full">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Drag and Drop */}
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-white'}`}
                >
                  <input {...getInputProps()} />
                  <div className="bg-blue-100 text-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold mb-1">Drag & drop resumes here</h3>
                  <p className="text-gray-500 text-sm mb-4">or click to browse from your computer (PDF only)</p>
                  <Button variant="outline" size="sm">Browse Files</Button>
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      Queued for Upload ({files.length})
                    </h3>
                    <ul className="space-y-3 mb-6">
                      {files.map((file, i) => (
                        <li key={i} className="flex flex-row items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                          <span className="text-sm font-medium text-gray-700 truncate mr-4">{file.name}</span>
                          <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-end">
                      <Button onClick={handleUpload} disabled={isUploading} size="lg">
                        {isUploading ? 'Processing Resumes...' : `Upload ${files.length} Resumes`}
                        {!isUploading && <ChevronRight className="w-4 h-4 ml-2" />}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'analyze' && (
              <motion.div
                key="analyze"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-8"
              >
                {/* JD Input */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" />
                      Job Description
                    </h3>
                  </div>
                  <textarea
                    className="w-full h-40 p-6 resize-none focus:outline-none text-gray-700"
                    placeholder="Paste the target job description here... (e.g. 'Looking for a Senior React Developer with 5 years experience, strong frontend skills, familiar with Node.js...')"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end">
                    <Button onClick={handleAnalyze} disabled={isAnalyzing || !jobDescription || resumeIds.length === 0} size="lg">
                      {isAnalyzing ? (
                         <>
                           <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" />
                           Analyzing...
                         </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          Rank Candidates
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Results List */}
                {results.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold tracking-tight">Match Results</h3>
                      <span className="text-sm text-gray-500">Showing Top {results.length} Candidates</span>
                    </div>
                    
                    <div className="space-y-4">
                      {results.map((candidate, idx) => {
                        const isTop = idx === 0;
                        const scoreColor = candidate.final_score >= 80 ? 'bg-green-600' : candidate.final_score >= 50 ? 'bg-amber-500' : 'bg-red-500';
                        const badgeVar = candidate.final_score >= 80 ? 'success' : candidate.final_score >= 50 ? 'default' : 'destructive';
                        
                        return (
                          <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            key={candidate.id}
                            className={`bg-white rounded-2xl border ${isTop ? 'border-blue-400 shadow-md ring-1 ring-blue-100' : 'border-gray-200 shadow-sm'} p-6 transition-all hover:shadow-md relative overflow-hidden`}
                          >
                            {isTop && (
                              <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-xl flex items-center gap-1 shadow-sm">
                                <Sparkles className="w-3 h-3" /> BEST MATCH
                              </div>
                            )}
                            
                            <div className="flex flex-col md:flex-row md:items-start gap-6">
                              {/* Left Side: Score & Name */}
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="text-xl font-bold text-gray-900">{candidate.candidate_name}</h4>
                                  <Badge variant={badgeVar as any}>{candidate.final_score}% Match</Badge>
                                </div>
                                
                                <p className="text-sm text-gray-600 mb-4 flex items-start gap-2">
                                  <Sparkles className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                                  <span className="italic">"{candidate.explanation}"</span>
                                </p>
                                
                                <div className="flex flex-wrap gap-2 mt-4">
                                  {candidate.extracted_skills.length > 0 ? (
                                    candidate.extracted_skills.slice(0, 8).map(s => (
                                      <Badge key={s} variant="secondary" className="bg-gray-100">
                                        {s}
                                      </Badge>
                                    ))
                                  ) : (
                                    <span className="text-sm text-gray-400">No defined skills matched perfectly.</span>
                                  )}
                                  {candidate.extracted_skills.length > 8 && (
                                    <Badge variant="secondary" className="bg-gray-50 border-dashed">
                                      +{candidate.extracted_skills.length - 8} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              {/* Right Side: Metrics */}
                              <div className="md:w-64 shrink-0 bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-4">
                                <div>
                                  <div className="flex justify-between text-xs font-semibold mb-1 text-gray-500 uppercase tracking-wider">
                                    <span>Overall Match</span>
                                    <span className="text-gray-900">{candidate.final_score}%</span>
                                  </div>
                                  <Progress value={candidate.final_score} indicatorColor={scoreColor} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-200">
                                  <div>
                                    <span className="block text-xs text-gray-500">Semantic</span>
                                    <span className="font-semibold text-sm">{candidate.semantic_score}%</span>
                                  </div>
                                  <div>
                                    <span className="block text-xs text-gray-500">Keyword</span>
                                    <span className="font-semibold text-sm">{candidate.skill_score}%</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

import axios from 'axios';

/** Absolute URLs must include `/api` (e.g. http://localhost:8000/api). We append `/api` if missing. */
function normalizeApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim().replace(/\/+$/, '');
  if (!raw) return '/api';
  if (/^https?:\/\//i.test(raw)) {
    return raw.toLowerCase().endsWith('/api') ? raw : `${raw}/api`;
  }
  return raw.startsWith('/') ? raw : `/${raw}`;
}

const BASE_URL = normalizeApiBase();

import type { JobRole, UploadResult, RankingResult, ResumeListItem, ResumePreview } from './types';

export const api = {
  getJobRoles: async (): Promise<JobRole[]> => {
    const res = await axios.get(`${BASE_URL}/job-roles`);
    return res.data;
  },

  createJobRole: async (title: string, description: string): Promise<JobRole> => {
    const res = await axios.post(`${BASE_URL}/job-roles`, { title, description });
    return res.data;
  },

  deleteJobRole: async (id: string): Promise<void> => {
    await axios.delete(`${BASE_URL}/job-roles/${id}`);
  },

  uploadResumes: async (jobRoleId: string, files: File[], batchLabel?: string): Promise<UploadResult[]> => {
    const formData = new FormData();
    if (batchLabel?.trim()) formData.append('batch_label', batchLabel.trim());
    files.forEach(file => formData.append('files', file));
    const res = await axios.post(`${BASE_URL}/job-roles/${jobRoleId}/resumes`, formData);
    return res.data.results;
  },

  listResumes: async (jobRoleId: string): Promise<ResumeListItem[]> => {
    const res = await axios.get(`${BASE_URL}/job-roles/${jobRoleId}/resumes`);
    return res.data;
  },

  getResumePreview: async (jobRoleId: string, resumeId: string): Promise<ResumePreview> => {
    const jid = encodeURIComponent(jobRoleId);
    const rid = encodeURIComponent(resumeId);
    const res = await axios.get(`${BASE_URL}/job-roles/${jid}/resumes/${rid}`);
    return res.data;
  },

  rankCandidates: async (jobRoleId: string): Promise<RankingResult> => {
    const res = await axios.post(`${BASE_URL}/job-roles/${jobRoleId}/rank`);
    return res.data;
  },

  getRankings: async (jobRoleId: string): Promise<RankingResult> => {
    const res = await axios.get(`${BASE_URL}/job-roles/${jobRoleId}/rankings`);
    return res.data;
  },

  openResumeNative: async (resumeId: string): Promise<{ status: string; message: string }> => {
    const res = await axios.post(`${BASE_URL}/resumes/${resumeId}/open-native`);
    return res.data;
  }
};

import axios from 'axios';

const BASE_URL = "http://localhost:8000/api";

import type { JobRole, UploadResult, RankingResult, Candidate } from './types';

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

  uploadResumes: async (jobRoleId: string, files: File[]): Promise<UploadResult[]> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    const res = await axios.post(`${BASE_URL}/job-roles/${jobRoleId}/resumes`, formData);
    return res.data.results;
  },

  rankCandidates: async (jobRoleId: string): Promise<RankingResult> => {
    const res = await axios.post(`${BASE_URL}/job-roles/${jobRoleId}/rank`);
    return res.data;
  },

  getRankings: async (jobRoleId: string): Promise<RankingResult> => {
    const res = await axios.get(`${BASE_URL}/job-roles/${jobRoleId}/rankings`);
    return res.data;
  }
};

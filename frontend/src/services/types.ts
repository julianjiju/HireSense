export interface JobRole {
  id: string;
  title: string;
  description: string;
  created_at: string;
  resume_count: number;
}

export interface UploadResult {
  filename: string;
  status: "success" | "error";
  error?: string;
  error_code?: string;
}

export interface ResumeListItem {
  id: string;
  filename: string;
  batch_label: string;
  upload_date: string;
  status: string;
  candidate_name_preview: string;
}

export interface Candidate {
  job_role_id?: string;
  resume_id: string;
  filename: string;
  candidate_name: string;
  years_of_experience_number?: number;
  top_skills?: string[];
  education?: string;
  experience_sections?: {
    professional_experience?: boolean;
    academic_projects?: boolean;
    certifications?: boolean;
    education_section?: boolean;
  };
  compatibility_score?: number;
  semantic_match_score?: number;
  structured_profile?: Record<string, unknown>;
  match: {
    match_score: number;
    semantic_match_score?: number;
    skill_match_analysis: string;
    experience_match_analysis: string;
    missing_skills: string[];
    reasoning: string;
    fit_summary_2_sentences?: string;
    recommendation: "Strong Hire" | "Hire" | "Maybe" | "Weak" | "Reject";
  };
}

export interface RankingResult {
  candidates: Candidate[];
}

export interface ResumePreview {
  filename: string;
  raw_text: string;
}

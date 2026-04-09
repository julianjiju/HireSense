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
}

export interface Candidate {
  resume_id: string;
  filename: string;
  candidate_name: string;
  match: {
    match_score: number;
    skill_match_analysis: string;
    experience_match_analysis: string;
    missing_skills: string[];
    reasoning: string;
    recommendation: "Strong Hire" | "Maybe" | "Reject";
  };
}

export interface RankingResult {
  candidates: Candidate[];
}

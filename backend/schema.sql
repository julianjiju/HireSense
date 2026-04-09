-- HireSense Production Schema (Supabase PostgreSQL)

-- 1. Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Resumes Table
CREATE TABLE IF NOT EXISTS resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    extracted_text TEXT,
    parsed_profile JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Match Results Table
CREATE TABLE IF NOT EXISTS match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    score FLOAT DEFAULT 0,
    justification TEXT,
    breakdown JSONB DEFAULT '{}',
    source TEXT DEFAULT 'gemini', -- 'gemini' or 'fallback'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, resume_id)
);

-- 4. AI Cache Table
CREATE TABLE IF NOT EXISTS ai_cache (
    hash_key TEXT PRIMARY KEY,
    response_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS) if needed, otherwise skip for MVP.
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

-- Allow public access for MVP (Update this in production!)
CREATE POLICY "Allow public read jobs" ON jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert jobs" ON jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read resumes" ON resumes FOR SELECT USING (true);
CREATE POLICY "Allow public insert resumes" ON resumes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read results" ON match_results FOR SELECT USING (true);
CREATE POLICY "Allow public insert results" ON match_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public cache" ON ai_cache FOR ALL USING (true);

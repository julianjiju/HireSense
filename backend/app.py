import os
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS
from parser import parse_pdf
from nlp_engine import score_candidate

app = Flask(__name__)
# Enable CORS for frontend requests
CORS(app)

# In-memory transient storage for resumes mapping UUID -> dict
uploaded_resumes = {}

@app.route('/upload', methods=['POST'])
def upload_resumes():
    if 'files' not in request.files:
        return jsonify({"error": "No files found in request"}), 400
    
    files = request.files.getlist('files')
    if not files:
        return jsonify({"error": "No files selected"}), 400

    parsed_resumes = []
    
    for file in files:
        if file.filename.endswith('.pdf'):
            # Read bytes from file stream
            text = parse_pdf(file.stream.read())
            c_id = str(uuid.uuid4())
            # Simple heuristic for name (removing .pdf)
            name = file.filename[:-4] 
            uploaded_resumes[c_id] = {
                "name": name,
                "text": text
            }
            parsed_resumes.append({
                "id": c_id,
                "name": name
            })
            
    return jsonify({
        "message": f"Successfully parsed {len(parsed_resumes)} resumes.",
        "resumes": parsed_resumes
    }), 200

@app.route('/rank', methods=['POST'])
def rank_candidates():
    data = request.json
    job_description = data.get('job_description', '')
    resume_ids = data.get('resume_ids', [])
    
    if not job_description:
        return jsonify({"error": "Job description is required"}), 400
        
    ids_to_rank = resume_ids if resume_ids else list(uploaded_resumes.keys())
    
    results = []
    
    for r_id in ids_to_rank:
        if r_id in uploaded_resumes:
            resume = uploaded_resumes[r_id]
            scores = score_candidate(resume["text"], job_description)
            results.append({
                "id": r_id,
                "candidate_name": resume["name"],
                **scores
            })
            
    # Sort descending based on final_score
    results = sorted(results, key=lambda x: x["final_score"], reverse=True)
    
    return jsonify({
        "ranked_candidates": results
    }), 200

if __name__ == '__main__':
    # Start the Flask app
    app.run(debug=True, port=5000)

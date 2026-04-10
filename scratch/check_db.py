import sqlite3
import json

conn = sqlite3.connect('backend/hiresense.db')
cursor = conn.cursor()

print("Last 3 Rankings:")
cursor.execute("SELECT id, job_role_id, results_json, ran_at FROM rankings ORDER BY ran_at DESC LIMIT 3")
for row in cursor.fetchall():
    print(f"ID: {row[0]}, Role ID: {row[1]}, Ran At: {row[3]}")
    results = json.loads(row[2])
    for res in results:
        print(f"  - {res.get('candidate_name')}: {res.get('match', {}).get('match_score')}%")

conn.close()

import sqlite3

conn = sqlite3.connect('backend/hiresense.db')
cursor = conn.cursor()

job_id = "5d7ad94d-507e-4283-a337-05307b436401"

print(f"Checking Job Role: {job_id}")
cursor.execute("SELECT id, title FROM job_roles WHERE id = ?", (job_id,))
role = cursor.fetchone()
if role:
    print(f"  Role Found: {role[1]}")
else:
    print("  Role NOT Found")

print("Checking Resumes for this Role:")
cursor.execute("SELECT id, filename FROM resumes WHERE job_role_id = ?", (job_id,))
resumes = cursor.fetchall()
if resumes:
    for r in resumes:
        print(f"  - Resume: {r[1]} (ID: {r[0]})")
else:
    print("  No Resumes Found for this role.")

conn.close()

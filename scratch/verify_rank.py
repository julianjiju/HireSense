import requests
import json

job_id = "5d7ad94d-507e-4283-a337-05307b436401"
url = f"http://localhost:8000/api/job-roles/{job_id}/rank"

print(f"Testing Rank Endpoint: {url}")
try:
    response = requests.post(url)
    print(f"Status: {response.status_code}")
    print(f"Body: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")

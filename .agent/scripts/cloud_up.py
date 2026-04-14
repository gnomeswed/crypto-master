import os
import requests

preset = "ale-moda"
cloud_url = "https://api.cloudinary.com/v1_1/dzl74jntw/image/upload"
images_dir = r"c:\Users\SWED\.gemini\antigravity\scratch\ale-bikinis\public\images\mockups"
files_to_upload = ["ai_navy_bikini.png", "ai_white_coverup.png", "ai_gold_swimsuit.png", "ai_terracotta.png"]

for f in files_to_upload:
    path = os.path.join(images_dir, f)
    if os.path.exists(path):
        with open(path, "rb") as bf:
            files = {"file": bf}
            data = {"upload_preset": preset}
            r = requests.post(cloud_url, files=files, data=data)
            if r.status_code == 200:
                url = r.json().get("secure_url")
                opt_url = url.replace('/upload/', '/upload/f_auto,q_auto/')
                print(opt_url)
            else:
                print("Error:", r.text)

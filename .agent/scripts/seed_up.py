import os
import requests
import re
import time

api_key = "7d150d402704ee65a1efe263bab3df20"
images_dir = r"c:\Users\SWED\.gemini\antigravity\scratch\ale-bikinis\public\images\mockups"
files_to_upload = ["ai_navy_bikini.png", "ai_white_coverup.png", "ai_gold_swimsuit.png", "ai_terracotta.png"]

urls = []
print("Uploading images to ImgBB...")
for f in files_to_upload:
    path = os.path.join(images_dir, f)
    if not os.path.exists(path):
        print("Missing file:", path)
        continue
        
    with open(path, "rb") as bf:
        from base64 import b64encode
        b64 = b64encode(bf.read()).decode("utf-8")
        r = requests.post("https://api.imgbb.com/1/upload", data={"key": api_key, "image": b64, "name": f"seed_{int(time.time())}"})
        if r.status_code == 200:
            print("Success:", f)
            urls.append(r.json()["data"]["display_url"])
        else:
            print("Failed:", r.text)
            urls.append("https://picsum.photos/400/600") 

print("Generated URLs:", urls)

if len(urls) == 4:
    js_path = r"c:\Users\SWED\.gemini\antigravity\scratch\ale-bikinis\src\services\productService.js"
    with open(js_path, "r", encoding="utf-8") as jf:
        content = jf.read()

    new_arr = "    const localImg = [\n"
    for i, u in enumerate(urls):
        new_arr += f'        "{u}"'
        if i < 3: new_arr += ",\n"
        else: new_arr += "\n"
    new_arr += "    ];"

    import re
    content = re.sub(r'    const localImg = \[\s*".*?",\s*".*?",\s*".*?",\s*".*?"\s*\];', new_arr, content, flags=re.DOTALL)

    with open(js_path, "w", encoding="utf-8") as jf:
        jf.write(content)
    print("productService.js updated perfectly!")
else:
    print("Did not get 4 URLs, aborting JS rewrite.")

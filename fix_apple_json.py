import os
import json

base_dir = 'FruitBench/Data/Apple'
json_path = 'FruitBench/json/Apple.json'

data = []
# Map folders to scores
scores = {
    'Mature': 90,
    'Unripe': 85,
    'Pest-damage': 40,
    'Rotten': 10
}

# Scan directory
image_id = 1
for folder, score in scores.items():
    folder_path = os.path.join(base_dir, folder)
    if os.path.exists(folder_path):
        for file in os.listdir(folder_path):
            if file.endswith('.png') or file.endswith('.jpg'):
                rel_path = f"../Data/Apple/{folder}/{file}"
                entry = {
                    "id": f"apple_{image_id:04d}",
                    "fruit_type": "Apple",
                    "image": rel_path,
                    "growth_stage": folder,
                    "recommendation": "Manual check",
                    "consumer_score": score
                }
                data.append(entry)
                image_id += 1

with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print(f"Generated {len(data)} entries in {json_path}")

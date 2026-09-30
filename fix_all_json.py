import os
import json

base_dir = 'FruitBench/Data'
json_dir = 'FruitBench/json'
os.makedirs(json_dir, exist_ok=True)

categories = [
    'Apple', 'Banana', 'DragonFruit', 'Grape', 'Guava', 'Kiwi', 
    'Lychee', 'Mango', 'Orange', 'Papaya', 'Peach', 'pear', 
    'Pomegranate', 'Pomelo', 'Strawberry', 'Tomato'
]

# Map folders to scores
scores = {
    'Mature': 90,
    'Unripe': 85,
    'Pest-damage': 40,
    'Rotten': 10
}

total_images = 0

for category in categories:
    cat_dir = os.path.join(base_dir, category)
    json_path = os.path.join(json_dir, f"{category}.json")
    
    data = []
    image_id = 1
    
    for folder, score in scores.items():
        folder_path = os.path.join(cat_dir, folder)
        if os.path.exists(folder_path):
            for file in os.listdir(folder_path):
                if file.endswith('.png') or file.endswith('.jpg'):
                    rel_path = f"../Data/{category}/{folder}/{file}"
                    entry = {
                        "id": f"{category.lower()}_{image_id:04d}",
                        "fruit_type": category,
                        "image": rel_path,
                        "growth_stage": folder,
                        "recommendation": "Manual check",
                        "consumer_score": score
                    }
                    data.append(entry)
                    image_id += 1
                    total_images += 1
                    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

print(f"Successfully generated JSON maps for {total_images} total images across 16 categories.")

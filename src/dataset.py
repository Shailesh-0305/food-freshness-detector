import os
import json
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image

class FruitFreshnessDataset(Dataset):
    def __init__(self, data_dir, json_dir, categories, transform=None):
        self.data_dir = data_dir
        self.json_dir = json_dir
        self.categories = categories
        self.transform = transform
        self.samples = []

        # Map growth stages/consumer score to our 4 target classes:
        # 0: Fresh (Score >= 80)
        # 1: Early Deterioration (Score 50-79)
        # 2: Moderate Deterioration (Score 20-49)
        # 3: Spoiled (Score < 20)
        
        self.load_data()

    def _get_freshness_class(self, score):
        if score >= 80:
            return 0
        elif score >= 50:
            return 1
        elif score >= 20:
            return 2
        else:
            return 3

    def load_data(self):
        for category in self.categories:
            json_path = os.path.join(self.json_dir, f"{category}.json")
            if not os.path.exists(json_path):
                print(f"Warning: {json_path} not found.")
                continue
                
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for item in data:
                    image_rel_path = item.get("image")
                    consumer_score = item.get("consumer_score", 100)
                    freshness_label = self._get_freshness_class(consumer_score)
                    
                    if image_rel_path:
                        # Path in JSON might be e.g. "Data/Tomato/Mature/0001.png"
                        # But our data_dir is "FruitBench/Data"
                        # We need to construct the absolute path carefully.
                        parts = image_rel_path.split("/")
                        if parts[0].lower() == "data":
                            parts = parts[1:]
                        
                        img_path = os.path.join(self.data_dir, *parts)
                        if os.path.exists(img_path):
                            self.samples.append((img_path, freshness_label))
                        else:
                            # Try with lowercase extension or path variations just in case
                            pass

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        image = Image.open(img_path).convert('RGB')
        
        if self.transform:
            image = self.transform(image)
            
        return image, label

def get_dataloaders(data_dir, json_dir, categories, batch_size=32, test_split=0.2):
    transform_train = transforms.Compose([
        transforms.RandomResizedCrop(224, scale=(0.8, 1.0)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, hue=0.1),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                             std=[0.229, 0.224, 0.225])
    ])
    
    transform_test = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                             std=[0.229, 0.224, 0.225])
    ])
    
    full_dataset = FruitFreshnessDataset(data_dir, json_dir, categories, transform=None)
    
    # Split
    total_size = len(full_dataset)
    test_size = int(total_size * test_split)
    train_size = total_size - test_size
    
    if total_size == 0:
        raise ValueError("No images loaded. Check data paths.")
        
    train_dataset, test_dataset = torch.utils.data.random_split(full_dataset, [train_size, test_size])
    
    # We need to apply different transforms, so we wrap the subsets
    class SubsetWrapper(Dataset):
        def __init__(self, subset, transform):
            self.subset = subset
            self.transform = transform
            
        def __getitem__(self, index):
            x, y = self.subset[index]
            if self.transform:
                x = self.transform(x)
            return x, y
            
        def __len__(self):
            return len(self.subset)
            
    train_dataset = SubsetWrapper(train_dataset, transform_train)
    test_dataset = SubsetWrapper(test_dataset, transform_test)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    
    return train_loader, test_loader, len(train_dataset), len(test_dataset)

if __name__ == "__main__":
    # Test script
    dataset_path = "../FruitBench/Data"
    json_path = "../FruitBench/json"
    categories = ["Apple", "Banana", "Tomato"]
    
    try:
        train_l, test_l, tr_size, te_size = get_dataloaders(dataset_path, json_path, categories)
        print(f"Loaded {tr_size} training images and {te_size} testing images.")
        
        for images, labels in train_l:
            print(f"Batch shape: {images.shape}")
            print(f"Labels: {labels}")
            break
    except Exception as e:
        print(f"Error during dataset test: {e}")

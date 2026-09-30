import os
import torch
import torch.nn as nn
import torch.optim as optim
from dataset import get_dataloaders
from model import FreshnessModel
from sklearn.metrics import accuracy_score, precision_recall_fscore_support

def train_model(data_dir, json_dir, model_path, epochs=3, batch_size=32):
    categories = [
        'Apple', 'Banana', 'DragonFruit', 'Grape', 'Guava', 'Kiwi', 
        'Lychee', 'Mango', 'Orange', 'Papaya', 'Peach', 'pear', 
        'Pomegranate', 'Pomelo', 'Strawberry', 'Tomato'
    ]
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    # Dataloaders
    train_loader, val_loader, tr_size, val_size = get_dataloaders(
        data_dir, json_dir, categories, batch_size=batch_size
    )
    print(f"Training images: {tr_size}, Validation images: {val_size}")
    
    # Model
    model = FreshnessModel(model_path).to(device)
    
    # Loss and Optimizer
    criterion = nn.CrossEntropyLoss()
    # Fine-tune with a small learning rate
    optimizer = optim.AdamW(model.parameters(), lr=1e-4)
    # Add a learning rate scheduler to reduce lr if validation loss stops improving
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=2, verbose=True)
    
    best_acc = 0.0
    
    os.makedirs("models", exist_ok=True)
    
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        
        for i, (inputs, labels) in enumerate(train_loader):
            inputs, labels = inputs.to(device), labels.to(device)
            
            optimizer.zero_grad()
            
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            
        # Validation
        model.eval()
        all_preds = []
        all_labels = []
        val_loss = 0.0
        
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                val_loss += loss.item()
                
                _, preds = torch.max(outputs, 1)
                all_preds.extend(preds.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
                
        acc = accuracy_score(all_labels, all_preds)
        precision, recall, f1, _ = precision_recall_fscore_support(all_labels, all_preds, average='macro', zero_division=0)
        
        print(f"Epoch {epoch+1}/{epochs}")
        print(f"Train Loss: {running_loss/len(train_loader):.4f} | Val Loss: {val_loss/len(val_loader):.4f}")
        print(f"Val Acc: {acc:.4f} | Precision: {precision:.4f} | Recall: {recall:.4f} | F1: {f1:.4f}")
        
        # Step the scheduler based on validation loss
        scheduler.step(val_loss/len(val_loader))
        
        if acc > best_acc:
            best_acc = acc
            torch.save(model.state_dict(), "models/freshness_model.pt")
            print("Saved best model.")
            
    print("Training complete.")

if __name__ == "__main__":
    dataset_path = "FruitBench/Data"
    json_path = "FruitBench/json"
    pretrained_model_path = "fruits-and-vegetables-detector-36" if os.path.exists("fruits-and-vegetables-detector-36") else "jazzmacedo/fruits-and-vegetables-detector-36"
    
    # Run full training loop for 20 epochs
    train_model(dataset_path, json_path, pretrained_model_path, epochs=20, batch_size=16)

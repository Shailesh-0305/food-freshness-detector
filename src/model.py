import torch
import torch.nn as nn
from transformers import ResNetForImageClassification

class FreshnessModel(nn.Module):
    def __init__(self, model_path, num_classes=4):
        super(FreshnessModel, self).__init__()
        # Load the base model (pre-trained on fruits/vegetables)
        # ignore_mismatched_sizes ensures we can load it even if we change the classifier
        self.base_model = ResNetForImageClassification.from_pretrained(
            model_path, 
            ignore_mismatched_sizes=True
        )
        
        # Replace the classifier layer with our 4 classes
        in_features = self.base_model.classifier[-1].in_features
        self.base_model.classifier[-1] = nn.Linear(in_features, num_classes)
        
    def forward(self, x):
        outputs = self.base_model(x)
        # Hugging Face models output a specialized object, we just want the logits
        return outputs.logits

import os

if __name__ == "__main__":
    # Test model loading
    model_path = "fruits-and-vegetables-detector-36" if os.path.exists("fruits-and-vegetables-detector-36") else "jazzmacedo/fruits-and-vegetables-detector-36"
    try:
        model = FreshnessModel(model_path)
        print("Model loaded successfully.")
        
        # Dummy input
        x = torch.randn(1, 3, 224, 224)
        out = model(x)
        print(f"Output shape: {out.shape}")  # Expected: [1, 4]
    except Exception as e:
        print(f"Error loading model: {e}")

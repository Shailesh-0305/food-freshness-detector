import torch
import torch.nn.functional as F
import numpy as np
import cv2
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget
from pytorch_grad_cam.utils.image import show_cam_on_image
from PIL import Image
from torchvision import transforms

def predict_freshness(model, image_tensor, device):
    """
    Predicts freshness class and confidence.
    Returns: class_idx, confidence, probabilities
    """
    model.eval()
    with torch.no_grad():
        inputs = image_tensor.unsqueeze(0).to(device)
        outputs = model(inputs)
        probs = F.softmax(outputs, dim=1).squeeze().cpu().numpy()
        
    class_idx = np.argmax(probs)
    confidence = probs[class_idx]
    
    return class_idx, confidence, probs

def identify_item(model, processor, image, labels, device):
    """
    Identifies the fruit/vegetable using CLIP zero-shot classification.
    Returns: best_label, confidence, all_probs
    """
    model.eval()
    
    # We will assume labels are already properly formatted for CLIP
    inputs = processor(text=labels, images=image, return_tensors="pt", padding=True).to(device)
    
    with torch.no_grad():
        outputs = model(**inputs)
        logits_per_image = outputs.logits_per_image # image-text similarity score
        probs = logits_per_image.softmax(dim=1).squeeze().cpu().numpy()
        
    class_idx = np.argmax(probs)
    confidence = probs[class_idx]
    best_label = labels[class_idx]
    
    return best_label, confidence, probs

def calculate_freshness_score(probs):
    """
    Calculates a 0-100 score based on weighted probabilities.
    Weights: Fresh (100), Early (70), Moderate (40), Spoiled (0)
    """
    weights = np.array([100, 70, 40, 0])
    score = np.sum(probs * weights)
    return score

def generate_gradcam(model, image_tensor, original_img, device, target_layer=None):
    """
    Generates Grad-CAM heatmap over the original image.
    If target_layer is None, tries to find the last conv layer for ResNet.
    """
    if target_layer is None:
        # Assuming HuggingFace ResNet
        try:
            target_layer = [model.base_model.resnet.encoder.stages[-1].layers[-1]]
        except AttributeError:
            print("Could not automatically find target layer for Grad-CAM. Please provide it.")
            return None
            
    cam = GradCAM(model=model, target_layers=target_layer)
    
    # We want to explain the highest predicted class
    targets = None 
    
    inputs = image_tensor.unsqueeze(0).to(device)
    grayscale_cam = cam(input_tensor=inputs, targets=targets)
    grayscale_cam = grayscale_cam[0, :]
    
    # Resize original image to match tensor size (224,224) if needed, or resize CAM to original
    orig_np = np.array(original_img).astype(np.float32) / 255.0
    orig_np = cv2.resize(orig_np, (224, 224))
    
    visualization = show_cam_on_image(orig_np, grayscale_cam, use_rgb=True)
    return visualization

if __name__ == "__main__":
    from model import FreshnessModel
    
    # Dummy test
    device = torch.device("cpu")
    model = FreshnessModel("fruits-and-vegetables-detector-36")
    
    # Random tensor as image
    img_tensor = torch.randn(3, 224, 224)
    original_img = Image.new('RGB', (224, 224))
    
    class_idx, conf, probs = predict_freshness(model, img_tensor, device)
    score = calculate_freshness_score(probs)
    
    print(f"Predicted class: {class_idx}")
    print(f"Confidence: {conf:.2f}")
    print(f"Score: {score:.2f}")
    
    # Requires pytorch-grad-cam installed
    # vis = generate_gradcam(model, img_tensor, original_img, device)
    # print(f"GradCAM generated: {vis.shape}")

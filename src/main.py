import os
import json
import torch
import numpy as np
from PIL import Image
from torchvision import transforms
from transformers import CLIPProcessor, CLIPModel

from model import FreshnessModel
from predict import predict_freshness, calculate_freshness_score, generate_gradcam, identify_item
from rl_agent import load_rl_agent

# Map model class index back to freshness stage name
STAGE_MAP = {
    0: "Fresh",
    1: "Early Deterioration",
    2: "Moderate Deterioration",
    3: "Spoiled"
}

ACTION_MAP = {
    0: "Continue Storage",
    1: "Consume Soon",
    2: "Discard"
}

class BackendPipeline:
    def __init__(self, model_path="fruits-and-vegetables-detector-36", rl_path="models/rl_policy"):
        if not os.path.exists(model_path):
            model_path = "jazzmacedo/fruits-and-vegetables-detector-36"
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Loading Models to {self.device}...")
        
        # Load the zero-shot CLIP model as the identifier/pre-filter
        clip_model_id = "openai/clip-vit-base-patch32"
        self.identifier_processor = CLIPProcessor.from_pretrained(clip_model_id)
        self.identifier_model = CLIPModel.from_pretrained(clip_model_id, use_safetensors=True).to(self.device)
        self.identifier_model.eval()
        
        # Define the valid classes we accept
        self.fruit_labels = [
            'Apple', 'Banana', 'DragonFruit', 'Grape', 'Guava', 'Kiwi', 
            'Lychee', 'Mango', 'Orange', 'Papaya', 'Peach', 'pear', 
            'Pomegranate', 'Pomelo', 'Strawberry', 'Tomato'
        ]
        self.other_labels = [
            'a person', 'a laptop or computer', 'furniture', 'a car', 
            'a building', 'a pet or animal', 'clothing', 'electronics', 
            'a random background object', 'text or document'
        ]
        self.identifier_labels = [f"a photo of a {f.lower()}" for f in self.fruit_labels] + self.other_labels
            
        self.dl_model = FreshnessModel(model_path).to(self.device)
        # Assuming we load the finest tuned weights here if available
        weights_path = "models/freshness_model.pt"
        if os.path.exists(weights_path):
            self.dl_model.load_state_dict(torch.load(weights_path, map_location=self.device, weights_only=True))
        self.dl_model.eval()
        
        print("Loading RL agent...")
        self.rl_agent = load_rl_agent(rl_path)
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def process_image(self, image_path, days_observed=0):
        """
        Runs the full backend pipeline on an image.
        """
        if not os.path.exists(image_path):
            return {"error": "Image not found."}
            
        # 1. Load and Preprocess Image
        image = Image.open(image_path).convert('RGB')
        img_tensor = self.transform(image)
        
        # 2. Identification Step using CLIP
        detected_item, id_confidence, _ = identify_item(
            self.identifier_model, 
            self.identifier_processor, 
            image, 
            self.identifier_labels, 
            self.device
        )
        
        # Threshold check - if confidence is too low or it predicts an 'other' class
        if detected_item in self.other_labels or id_confidence < 0.20:
            return {
                "is_fruit": False,
                "error": "Not a fruit or vegetable.",
                "detected_item": "Unknown Object",
                "identification_confidence": float(id_confidence)
            }
            
        # Clean up the detected item string (remove "a photo of a ")
        clean_item = detected_item.replace("a photo of a ", "").replace("a photo of an ", "").title()
        
        # 3. DL Model Prediction (Freshness)
        class_idx, confidence, probs = predict_freshness(self.dl_model, img_tensor, self.device)
        freshness_stage = STAGE_MAP.get(class_idx, "Unknown")
        
        # 3. Freshness Score Calculation
        score = calculate_freshness_score(probs)
        
        # 4. Generate Explainability (Grad-CAM)
        # Grad-CAM might fail if pytorch-grad-cam is not installed, so wrap in try-except
        cam_image = None
        try:
            cam_image = generate_gradcam(self.dl_model, img_tensor, image, self.device)
            # You could save this cam_image to disk here or return it
            # cv2.imwrite("output_cam.png", cv2.cvtColor(cam_image, cv2.COLOR_RGB2BGR))
        except Exception as e:
            print(f"Grad-CAM error: {e}")
            
        # 5. RL Decision Layer
        recommendation = "Manual Inspection Required"
        if self.rl_agent:
            # RL State: [Score, Confidence, Days]
            state = np.array([score, float(confidence), float(days_observed)], dtype=np.float32)
            action, _ = self.rl_agent.predict(state, deterministic=True)
            recommendation = ACTION_MAP.get(int(action), "Unknown Action")
            
        return {
            "is_fruit": True,
            "detected_item": clean_item,
            "identification_confidence": float(id_confidence),
            "freshness_stage": freshness_stage,
            "confidence": float(confidence),
            "freshness_score": float(score),
            "recommendation": recommendation,
            "has_gradcam": cam_image is not None
        }

if __name__ == "__main__":
    import sys
    import json
    
    is_json = "--json" in sys.argv
    if is_json:
        sys.argv.remove("--json")
    
    # Simple CLI test
    pipeline = BackendPipeline()
    
    if len(sys.argv) > 1:
        test_img = sys.argv[1]
    else:
        # Use a dummy test image if one isn't provided
        # Let's see if we can find one in the dataset
        test_img = "FruitBench/Data/Tomato/Mature/0001.png"
        
    if not is_json:
        print(f"\nProcessing {test_img}...")
        
    result = pipeline.process_image(test_img)
    
    if is_json:
        # Wrap the result in distinct tags so the Node backend can parse it despite other prints
        print(f"\n__RESULT_JSON_START__\n{json.dumps(result)}\n__RESULT_JSON_END__\n")
    else:
        print("\n--- RESULTS ---")
        for k, v in result.items():
            print(f"{k.replace('_', ' ').title()}: {v}")

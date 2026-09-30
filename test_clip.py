import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel
import urllib.request
import io

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
clip_model_id = 'openai/clip-vit-base-patch32'
processor = CLIPProcessor.from_pretrained(clip_model_id)
model = CLIPModel.from_pretrained(clip_model_id, use_safetensors=True).to(device)

labels = ['Apple', 'Banana', 'Tomato', 'Other']
text_inputs = [
    f'a photo of a {label}' if label != 'Other' 
    else 'a photo of a random background object that is not a fruit or vegetable' 
    for label in labels
]

def test_image(url, name):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    img_data = urllib.request.urlopen(req).read()
    image = Image.open(io.BytesIO(img_data)).convert('RGB')
    
    inputs = processor(text=text_inputs, images=image, return_tensors='pt', padding=True).to(device)
    with torch.no_grad():
        outputs = model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=1).squeeze().cpu().numpy()
        
    print(f'\\n--- Testing: {name} ---')
    for i, label in enumerate(labels):
        print(f'{label}: {probs[i]:.4f}')

test_image('https://upload.wikimedia.org/wikipedia/commons/e/e0/Car_with_a_view.jpg', 'Car')
test_image('https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg', 'Cat')
test_image('https://upload.wikimedia.org/wikipedia/commons/8/89/Tomato_je.jpg', 'Tomato')
test_image('https://upload.wikimedia.org/wikipedia/commons/1/15/Red_Apple.jpg', 'Apple')


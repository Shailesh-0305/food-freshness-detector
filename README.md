# 🥑 Food Freshness Detector (FoodLens AI)

An AI-powered computer vision and decision-support system designed to assess the freshness condition of fruits and vegetables, visualize spoilage through explainability maps (Grad-CAM), and provide intelligent post-inspection recommendations using Reinforcement Learning.

Aligned with **UN Sustainable Development Goal 12 (Target 12.3: Halve per-capita global food waste)**.

---

## 🌟 Key Highlights

- **Multi-Stage Deterioration Classification**: Rather than a basic binary fresh/spoiled check, the deep learning model evaluates continuous decay across 4 distinct stages:
  1. *Fresh* (Optimal condition)
  2. *Early Deterioration* (Initial loss of firmness/color change)
  3. *Moderate Deterioration* (Visible blemishes or decay)
  4. *Spoiled* (Unfit for consumption)
- **Zero-Shot Produce Identification & Pre-filtering**: Leverages OpenAI's CLIP (`openai/clip-vit-base-patch32`) to verify produce identity and filter out non-produce objects or invalid images.
- **Explainable AI (Grad-CAM)**: Generates visual saliency heatmaps highlighting exact regions influencing the freshness score.
- **Reinforcement Learning Decision Layer**: A Gymnasium-based PPO agent evaluates the freshness score, stage, and confidence to recommend optimal next actions:
  - `Continue Storage`
  - `Consume Soon`
  - `Discard`
- **Modern Web Application**: Responsive glassmorphism interface (`FrontEnd/`) featuring real-time camera inspection, photo upload, inspection history, and audio feedback.

---

## 📁 Repository Structure

```
food-freshness-detector/
├── FrontEnd/                 # Interactive multi-page web interface
│   ├── index.html            # Landing / welcome page
│   ├── detection.html        # Live camera & upload inspection workspace
│   ├── history.html          # Scan history & analytics dashboard
│   ├── about.html            # System architecture and methodology
│   ├── script.js             # Client logic, camera handling, audio & animations
│   └── style.css             # Glassmorphism styling and UI themes
├── public/                   # Minimal webcam capture interface
│   ├── index.html
│   └── app.js
├── src/                      # Core AI / ML pipeline
│   ├── api.py                # FastAPI REST API serving endpoints and UI
│   ├── main.py               # Unified inference pipeline (CLIP + ResNet + RL)
│   ├── model.py              # FreshnessModel ResNet architecture definition
│   ├── predict.py            # Freshness score, classification & Grad-CAM routines
│   ├── dataset.py            # Dataset loading and data augmentation
│   ├── rl_agent.py           # PPO Reinforcement Learning agent training & loading
│   ├── rl_environment.py     # Custom Gymnasium environment for RL policy
│   └── train.py              # Supervised fine-tuning pipeline
├── models/                   # Model weight checkpoints
│   ├── freshness_model.pt    # Fine-tuned ResNet freshness classifier (~94.4 MB)
│   └── rl_policy.zip         # Trained PPO reinforcement learning policy
├── fix_all_json.py           # Dataset annotation helper
├── fix_apple_json.py         # Apple dataset annotation script
├── test_clip.py              # Zero-shot CLIP testing script
├── server.js                 # Node.js / Express server bridge
├── package.json              # Node.js dependencies and scripts
├── requirements.txt          # Python dependencies
├── .gitignore                # Git exclusions
└── README.md                 # Project documentation
```

---

## 🚀 Getting Started

### 1. Prerequisites

- **Python**: Version 3.10 or 3.11 recommended
- **Node.js**: Version 18+ (if using the Node / Express backend)
- **CUDA**: Optional, automatically utilized if available on your GPU

### 2. Clone the Repository

```bash
git clone https://github.com/Shailesh-0305/food-freshness-detector.git
cd food-freshness-detector
```

### 3. Python Environment Setup

Create and activate a virtual environment:

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux / macOS
python3 -m venv venv
source venv/bin/activate
```

Install the required Python packages:

```bash
pip install -r requirements.txt
```

### 4. Node.js Setup (Optional for Express Bridge)

```bash
npm install
```

---

## 💻 Running the Application

You can run the application using either **FastAPI (Python)** or **Express (Node.js)**:

### Option A: FastAPI Backend (Recommended)

FastAPI serves both the REST endpoints and the full static frontend at `http://localhost:8000`:

```bash
uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload
```

Then open `http://localhost:8000` in your web browser.

### Option B: Node.js / Express Bridge

The Express server spawns the Python inference pipeline on demand:

```bash
npm start
```
Or:
```bash
node server.js
```

Then visit `http://localhost:3000` for the webcam interface or `http://localhost:3000/frontend/` for the complete UI.

---

## 🧠 Model Pipeline Details

1. **Pre-Filter (CLIP)**:
   - Validates that an image contains a supported produce item (e.g. Apple, Banana, Tomato, Orange, etc.).
   - Discards non-food inputs (people, electronics, vehicles, backgrounds).
2. **Freshness Classification (ResNet)**:
   - Base model: Pre-trained ResNet (`jazzmacedo/fruits-and-vegetables-detector-36`).
   - Classifier head adapted for 4 freshness stages.
   - Calculates continuous freshness score from 0% to 100%.
3. **Interpretability (Grad-CAM)**:
   - Computes gradients of the target class with respect to the final convolutional feature maps to produce visual heatmaps.
4. **Action Policy (PPO RL)**:
   - State space: `[Freshness Score, Stage Index, Model Confidence]`.
   - Action space: `[0: Continue Storage, 1: Consume Soon, 2: Discard]`.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).

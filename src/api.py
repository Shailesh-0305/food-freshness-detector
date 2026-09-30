import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import sys

# Ensure src is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import BackendPipeline

app = FastAPI(title="FoodLens API")

# Allow CORS if needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global pipeline instance (loaded once on startup)
pipeline = None

@app.on_event("startup")
async def startup_event():
    global pipeline
    print("Initializing BackendPipeline (loading models to GPU)...")
    pipeline = BackendPipeline()
    print("BackendPipeline initialized successfully!")

@app.post("/api/analyze")
async def analyze_image(image: UploadFile = File(...)):
    if not image:
        raise HTTPException(status_code=400, detail="No image provided")
        
    temp_path = f"temp_{image.filename}"
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        result = pipeline.process_image(temp_path)
        
        # Result format from main.py:
        # {
        #     "is_fruit": True,
        #     "detected_item": detected_item.title(),
        #     "identification_confidence": float(id_confidence),
        #     "freshness_stage": freshness_stage,
        #     "confidence": float(confidence),
        #     "freshness_score": float(score),
        #     "recommendation": recommendation,
        #     "has_gradcam": cam_image is not None
        # }
        
        if not result.get("is_fruit"):
            return JSONResponse({
                "food": result.get("detected_item", "Unknown"),
                "condition": "Unknown",
                "confidence": result.get("identification_confidence", 0) * 100,
                "insight": result.get("error", "This item does not appear to be a recognized fruit or vegetable.")
            })
            
        # condition mapping
        stage = result.get("freshness_stage", "Unknown")
        cond = "Rotten" if "Deterioration" in stage or "Spoiled" in stage else "Fresh"
        
        # We also pass the detailed stage and recommendation as insight
        insight = f"Detailed Stage: {stage}. Recommendation: {result.get('recommendation', '')}"
        
        return JSONResponse({
            "food": result.get("detected_item", "Unknown"),
            "condition": cond,
            "confidence": result.get("confidence", 0) * 100,
            "insight": insight
        })
        
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

# Serve the frontend statically
frontend_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "FrontEnd")
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

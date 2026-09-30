const video = document.getElementById('webcam');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('captureBtn');
const uploadBtn = document.getElementById('uploadBtn');
const fileUpload = document.getElementById('fileUpload');
const resultsPanel = document.getElementById('resultsPanel');
const loading = document.getElementById('loading');

// Initialize webcam
async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment', width: 640, height: 480 } 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing webcam:", err);
        alert("Could not access the webcam. Please ensure you have granted permissions.");
    }
}

setupWebcam();

// Capture and Analyze
captureBtn.addEventListener('click', async () => {
    // UI state
    captureBtn.disabled = true;
    uploadBtn.disabled = true;
    loading.style.display = 'block';
    resultsPanel.classList.remove('active');

    // Draw video frame to canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob and send
    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        // backend expects 'image'
        formData.append('image', blob, 'capture.png'); 

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                displayResults(data);
            } else {
                alert(`Error: ${data.error || 'Failed to process image'}`);
                console.error(data);
            }
        } catch (error) {
            alert("Network error: Could not reach the server.");
            console.error(error);
        } finally {
            captureBtn.disabled = false;
            uploadBtn.disabled = false;
            loading.style.display = 'none';
        }
    }, 'image/png');
});

// Trigger file input click when upload button is clicked
uploadBtn.addEventListener('click', () => {
    fileUpload.click();
});

// Handle file selection
fileUpload.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // UI state
    captureBtn.disabled = true;
    uploadBtn.disabled = true;
    loading.style.display = 'block';
    resultsPanel.classList.remove('active');

    const formData = new FormData();
    formData.append('image', file); 

    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayResults(data);
        } else {
            alert(`Error: ${data.error || 'Failed to process image'}`);
            console.error(data);
        }
    } catch (error) {
        alert("Network error: Could not reach the server.");
        console.error(error);
    } finally {
        captureBtn.disabled = false;
        uploadBtn.disabled = false;
        loading.style.display = 'none';
        // Reset file input so the same file can be uploaded again if needed
        fileUpload.value = '';
    }
});

function displayResults(data) {
    if (data.is_fruit === false) {
        alert(`Item not recognized! Please show a valid fruit or vegetable. (Detected as: ${data.detected_item})`);
        return;
    }

    document.getElementById('resItem').textContent = data.detected_item || '--';
    document.getElementById('resStage').textContent = data.freshness_stage || '--';
    
    // Format score
    const score = data.freshness_score ? Math.round(data.freshness_score) : 0;
    const scoreEl = document.getElementById('resScore');
    scoreEl.textContent = `${score}/100`;
    
    // Color code based on score
    scoreEl.className = 'value'; // reset
    if (score < 40) scoreEl.classList.add('danger');
    else if (score < 75) scoreEl.classList.add('warning');

    // Format confidence
    const conf = data.confidence ? Math.round(data.confidence * 100) : 0;
    document.getElementById('resConf').textContent = `${conf}%`;

    // Format recommendation
    const recEl = document.getElementById('resRec');
    recEl.textContent = data.recommendation || '--';
    recEl.className = 'value';
    if (data.recommendation === 'Discard') recEl.classList.add('danger');
    else if (data.recommendation === 'Consume Soon') recEl.classList.add('warning');

    resultsPanel.classList.add('active');
}

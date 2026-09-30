const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Setup multer for saving uploaded images
const upload = multer({ 
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    })
});

app.use(express.static('public'));
app.use('/frontend', express.static('FrontEnd'));
app.use(express.json());

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

app.post('/api/analyze', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    const imagePath = req.file.path;
    console.log(`Processing image: ${imagePath}`);

    // Spawn the Python process
    // Use the py311 venv if present, otherwise fallback to system python
    let pythonExecutable = path.join(__dirname, '.venv_py311', 'Scripts', 'python.exe');
    if (!fs.existsSync(pythonExecutable)) {
        pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    }
    const pythonScript = path.join(__dirname, 'src', 'main.py');
    
    const pythonProcess = spawn(pythonExecutable, [pythonScript, imagePath, '--json']);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
        // Stream stdout to console to see what python is doing (like loading cuda)
        console.log(data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
        console.error(`Python Stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        // Clean up the uploaded file to save space
        fs.unlink(imagePath, (err) => {
            if (err) console.error("Error deleting temp file:", err);
        });

        if (code !== 0) {
            return res.status(500).json({ error: 'Python process failed', details: stderrData });
        }

        // Extract JSON from the output block
        try {
            const startMarker = '__RESULT_JSON_START__';
            const endMarker = '__RESULT_JSON_END__';
            const startIndex = stdoutData.indexOf(startMarker);
            const endIndex = stdoutData.indexOf(endMarker);

            if (startIndex !== -1 && endIndex !== -1) {
                const jsonStr = stdoutData.substring(startIndex + startMarker.length, endIndex).trim();
                const result = JSON.parse(jsonStr);
                return res.json(result);
            } else {
                return res.status(500).json({ error: 'Failed to parse Python output', raw: stdoutData });
            }
        } catch (e) {
            return res.status(500).json({ error: 'JSON parsing error', details: e.message });
        }
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Open this URL in your browser to access the webcam UI.');
});

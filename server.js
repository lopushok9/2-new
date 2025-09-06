const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Ensure required directories exist
const uploadDir = 'uploads';
const historyDir = 'history';
[uploadDir, historyDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Routes
app.get('/', (req, res) => {
  // Get history items
  const historyItems = fs.readdirSync(historyDir)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      const content = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
      return {
        id: path.basename(file, '.json'),
        timestamp: content.timestamp,
        message: content.message || 'No message',
        preview: content.preview
      };
    })
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10); // Show only last 10 items

  res.render('index', { historyItems });
});

// Get history item details
app.get('/api/history/:id', (req, res) => {
  try {
    const filePath = path.join(historyDir, `${req.params.id}.json`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'History item not found' });
    }
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json(content);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving history item' });
  }
});

// AI endpoint
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    console.log('Received request for image analysis');
    const message = req.body.message;
    const imageFile = req.file;
    
    if (!imageFile) {
      console.error('No image file provided');
      return res.status(400).json({ error: 'No image file provided' });
    }

    console.log('Image file received:', imageFile.filename);
    
    // Read the file and convert to base64
    const imageBuffer = fs.readFileSync(imageFile.path);
    const base64Image = imageBuffer.toString('base64');
    const imageUrl = `data:${imageFile.mimetype};base64,${base64Image}`;
    
    // Create a smaller preview image (store first 100KB of base64)
    const preview = base64Image.substring(0, 100000);
    
    // Prepare the request body
    const requestBody = {
      model: "meta-llama/llama-3.2-11b-vision-instruct:free",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: message || "What is in this image? Please provide a detailed description."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ]
    };

    console.log('Making request to OpenRouter API');
    
    // Make request to OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer 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",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "AI Image Analysis",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenRouter API error:', errorData);
      return res.status(response.status).json({ 
        error: 'Error from OpenRouter API', 
        details: errorData 
      });
    }

    const data = await response.json();
    console.log('Received response from OpenRouter API');
    
    // Save to history
    const historyItem = {
      timestamp: Date.now(),
      message: message || 'No message',
      preview: `data:${imageFile.mimetype};base64,${preview}`,
      result: data.choices[0].message.content,
      fullImage: imageUrl
    };
    
    const historyId = Date.now().toString();
    fs.writeFileSync(
      path.join(historyDir, `${historyId}.json`),
      JSON.stringify(historyItem, null, 2)
    );
    
    // Clean up the uploaded file
    fs.unlinkSync(imageFile.path);
    
    res.json({ ...data, historyId });
  } catch (error) {
    console.error('Error in /api/analyze:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

const PORT = process.env.PORT || 3000;
let server;

// Function to start the server
function startServer(port) {
  return new Promise((resolve, reject) => {
    server = app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      resolve();
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is busy, trying ${port + 1}`);
        resolve(startServer(port + 1));
      } else {
        reject(err);
      }
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start the server
startServer(PORT).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
}); 
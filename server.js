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

// Настройка пути к шаблонам
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Папка для статических файлов (если есть)
app.use(express.static(path.join(__dirname, 'public')));

// Multer — для обработки файлов в памяти (т.к. на Vercel нет диска)
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Маршрут GET /
app.get('/', (req, res) => {
  res.render('index', { historyItems: [] });
});

// POST-запрос с изображением или текстом
app.post('/', upload.single('image'), async (req, res) => {
  try {
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file ? req.file.originalname : 'No file');

    const message = req.body.message;
    const imageFile = req.file;

    let requestBody;

    if (imageFile) {
      const base64Image = imageFile.buffer.toString('base64');
      const imageUrl = `data:${imageFile.mimetype};base64,${base64Image}`;

      requestBody = {
        model: "meta-llama/llama-3.2-11b-vision-instruct:free",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: message || "What is in this image?" },
              { type: "image_url", image_url: { url: imageUrl } }
            ]
          }
        ]
      };
    } else if (message) {
      requestBody = {
        model: "meta-llama/llama-3.2-11b-instruct:free",
        messages: [{ role: "user", content: message }]
      };
    } else {
      return res.status(400).json({ error: 'No image or message provided' });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
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
    res.json(data);

  } catch (error) {
    console.error('Error in POST /:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Не запускаем сервер — экспортируем его для Vercel
module.exports = app;
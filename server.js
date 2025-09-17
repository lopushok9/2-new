const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
// Новый импорт для Supabase
const { createClient } = require('@supabase/supabase-js');

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

// Инициализация Supabase клиента
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables');
}
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false, // Отключено для serverless
    persistSession: false, // Не нужно для сервера
  },
});

// Маршрут GET /
app.get('/', (req, res) => {
  res.render('index', { historyItems: [] });
});

// Маршрут GET /about
app.get('/about', (req, res) => {
  res.render('about');
});

// lending
app.get('/landing', (req, res) => {
  res.render('landing');
});

app.get('/roadmap', (req, res) => {
  res.render('roadmap');
});

app.get('/auth', (req, res) => {
  res.render('auth');
});

app.get('/profile', authenticate, async (req, res) => {
    const { user } = req;
    const { data, error } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', user.id)
        .single();
    if (error) return res.status(500).json({ error: error.message });
    res.render('profile', { user: data });
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
        model: "meta-llama/llama-4-maverick:free",
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
        model: "meta-llama/llama-4-scout:free",
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

// Новый маршрут: Регистрация пользователя
app.post('/api/signup', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert([{ user_id: authData.user.id, name, email }]);

    if (profileError) {
      return res.status(500).json({ error: 'Failed to create profile', details: profileError.message });
    }

    return res.status(201).json({
      message: 'User registered successfully',
      user: { id: authData.user.id, email: authData.user.email, name },
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Новый маршрут: Авторизация пользователя
app.post('/api/signin', async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    // Проверка на существование session
    if (!data.session || !data.session.access_token) {
      return res.status(500).json({ error: 'Session or access token not returned by Supabase' });
    }

    return res.status(200).json({
      message: 'User signed in successfully',
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.name || 'Unknown',
      },
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export the app for Vercel
module.exports = app;

const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser'); // Добавляем для работы с cookies

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Добавляем парсер cookies

// Настройка пути к шаблонам
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Папка для статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Multer для обработки файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables');
}
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Middleware для аутентификации (обновленный с поддержкой cookies)
const authenticate = async (req, res, next) => {
  // Читаем токен из cookies или заголовка Authorization
  const tokenFromCookie = req.cookies.access_token;
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const token = tokenFromCookie || tokenFromHeader;

  console.log('Authenticate middleware - Token from cookie:', tokenFromCookie); // Отладка
  console.log('Authenticate middleware - Token from header:', tokenFromHeader); // Отладка

  if (!token) {
    console.log('No token provided, redirecting to /auth');
    return res.status(401).redirect('/auth');
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      console.log('Invalid token error:', error?.message);
      return res.status(401).redirect('/auth');
    }

    console.log('User authenticated:', data.user.email);
    req.user = data.user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).redirect('/auth');
  }
};

// Маршруты
app.get('/', (req, res) => res.render('index', { historyItems: [] }));
app.get('/about', (req, res) => res.render('about'));
app.get('/landing', (req, res) => res.render('landing'));
app.get('/roadmap', (req, res) => res.render('roadmap'));
app.get('/auth', (req, res) => res.render('auth'));

app.post('/', upload.single('image'), async (req, res) => {
  try {
    const message = req.body.message;
    const imageFile = req.file;

    let requestBody = imageFile
      ? {
          model: "meta-llama/llama-4-maverick:free",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: message || "What is in this image?" },
                { type: "image_url", image_url: { url: `data:${imageFile.mimetype};base64,${imageFile.buffer.toString('base64')}` } }
              ]
            }
          ]
        }
      : {
          model: "meta-llama/llama-4-scout:free",
          messages: [{ role: "user", content: message }]
        };

    if (!imageFile && !message) return res.status(400).json({ error: 'No image or message provided' });

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
      return res.status(response.status).json({ error: 'Error from OpenRouter API', details: errorData });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error in POST /:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/api/signup', async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, password, and name are required' });

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (authError) return res.status(400).json({ error: authError.message });

    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{ user_id: authData.user.id, name, email }]);

    if (profileError) return res.status(500).json({ error: 'Failed to create profile', details: profileError.message });

    res.status(201).json({ message: 'User registered successfully', user: { id: authData.user.id, email, name } });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

app.post('/api/signin', async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(401).json({ error: error.message });

    if (!data.session || !data.session.access_token) {
      return res.status(500).json({ error: 'Session or access token not returned by Supabase' });
    }

    // Устанавливаем HttpOnly cookie с токеном
    res.cookie('access_token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Только для HTTPS в продакшене
      sameSite: 'strict',
      maxAge: 3600000, // 1 час
    });

    res.status(200).json({
      message: 'User signed in successfully',
      user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || 'Unknown' },
      access_token: data.session.access_token, // Для обратной совместимости с клиентом
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Маршрут для профиля (защищенный)
app.get('/profile', authenticate, async (req, res) => {
  try {
    console.log('Fetching profile for user:', req.user.email);
    const { data, error } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', req.user.id)
      .single();

    if (error) throw new Error(error.message);

    res.render('profile', { user: data });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).redirect('/auth');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

module.exports = app;

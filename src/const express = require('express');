const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Настройка пути к шаблонам
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Папка для статических файлов (если есть)
app.use(express.static(path.join(__dirname, 'public')));

// Multer — для обработки файлов в памяти
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ======================
// 🔹 Подключение к базе
// ======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ======================
// 🔹 JWT утилиты
// ======================
function generateAccessToken(user) {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: "15m" });
}

function generateRefreshToken(user) {
  return jwt.sign(user, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
}

// Middleware для проверки access токена
function authMiddleware(req, res, next) {
  const header = req.headers["authorization"];
  if (!header) return res.sendStatus(401);

  const token = header.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ======================
// 🔹 Auth маршруты
// ======================
app.post("/auth/register", async (req, res) => {
  const { email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [email, hashed]);
    res.json({ message: "Пользователь зарегистрирован" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Email уже используется" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
  const user = result.rows[0];
  if (!user) return res.status(400).json({ error: "Неверный email" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ error: "Неверный пароль" });

  const userData = { id: user.id, email: user.email };
  const accessToken = generateAccessToken(userData);
  const refreshToken = generateRefreshToken(userData);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query("INSERT INTO tokens (user_id, refresh_token, expires_at) VALUES ($1, $2, $3)", [
    user.id, refreshToken, expiresAt
  ]);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true, // true в продакшене
    sameSite: "strict"
  });

  res.json({ accessToken });
});

app.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) return res.sendStatus(401);

  const result = await pool.query("SELECT * FROM tokens WHERE refresh_token=$1", [refreshToken]);
  const tokenRow = result.rows[0];
  if (!tokenRow) return res.sendStatus(403);

  jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, user) => {
    if (err) return res.sendStatus(403);
    const accessToken = generateAccessToken({ id: user.id, email: user.email });
    res.json({ accessToken });
  });
});

app.post("/auth/logout", async (req, res) => {
  const { refreshToken } = req.cookies;
  await pool.query("DELETE FROM tokens WHERE refresh_token=$1", [refreshToken]);
  res.clearCookie("refreshToken");
  res.json({ message: "Вы вышли" });
});

// Пример защищённого маршрута
app.get("/profile", authMiddleware, (req, res) => {
  res.json({ message: "Привет! Это защищённая страница.", user: req.user });
});

// ======================
// 🔹 Твои существующие маршруты
// ======================
app.get('/', (req, res) => {
  res.render('index', { historyItems: [] });
});

app.get('/about', (req, res) => res.render('about'));
app.get('/landing', (req, res) => res.render('landing'));
app.get('/roadmap', (req, res) => res.render('roadmap'));

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
      return res.status(response.status).json({ error: 'Error from OpenRouter API', details: errorData });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error('Error in POST /:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;

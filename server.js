require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser'); // Добавляем для работы с cookies
const { PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const nacl = require('tweetnacl');

const app = express();

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ['https://whatbirdai.com'];
    if (!origin || allowedOrigins.includes(origin) || (origin && origin.startsWith('http://localhost'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
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
const upload = multer({ storage: storage });

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

// Middleware для аутентификации, которое обрабатывает оба типа токенов
const authenticateFlexible = async (req, res, next) => {
  const token = req.cookies.access_token;

  if (!token) {
    console.log('Auth-Flexible: No token found, redirecting to /auth');
    return res.status(401).redirect('/auth');
  }

  // 1. Попытка верификации как Supabase JWT
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      console.log('Auth-Flexible: Supabase user authenticated:', data.user.email);
      req.user = data.user;
      return next();
    }
  } catch (jwtError) {
    console.log('Auth-Flexible: Not a valid Supabase token, proceeding to check for Solana.', jwtError.message);
  }

  // 2. Если не получилось, попытка верификации как Solana токен
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    if (decoded.authMethod === 'solana' && decoded.publicKey) {
      console.log('Auth-Flexible: Solana user authenticated:', decoded.email);
      req.user = {
        id: decoded.publicKey,
        email: decoded.email,
        user_metadata: {
          name: decoded.name,
          solana_public_key: decoded.publicKey,
          auth_method: 'solana'
        }
      };
      return next();
    }
  } catch (solanaError) {
     console.log('Auth-Flexible: Failed to decode as Solana token.', solanaError.message);
  }

  // 3. Если ни один из способов не сработал
  console.log('Auth-Flexible: Token is invalid for both Supabase and Solana. Redirecting.');
  res.clearCookie('access_token'); // Очищаем невалидный токен
  return res.status(401).redirect('/auth');
};

// Маршруты
app.get('/', (req, res) => res.render('newland', { historyItems: [] }));
app.get('/about', (req, res) => res.render('about'));
app.get('/landing', (req, res) => res.render('landing'));
app.get('/roadmap', (req, res) => res.render('roadmap'));
app.get('/auth', (req, res) => res.render('auth'));


app.post('/', upload.single('image'), async (req, res) => {
  try {
    const message = req.body.message;
    const imageFile = req.file;
    const systemPrompt = `You are a bird identification expert. Based on a photo, sound, or location/date information, describe the bird in **plain, easy-to-understand language**.  

Include:
- The most likely species (common name, and optionally scientific name)  
- Key visible features (color, shape, size, distinctive marks)  
- Confidence level (high, medium, low)  

If you are unsure, mention up to 2–3 possible species and suggest what additional photos or observations could help identify it.`;

    let requestBody = imageFile
      ? {
          model: "meta-llama/llama-4-maverick:free",
          messages: [
            { role: "system", content: systemPrompt },
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
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ]
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

// Новый endpoint для Solana аутентификации
app.post('/api/solana-auth', async (req, res) => {
  try {
    const { publicKey, message, signature } = req.body;
    
    if (!publicKey || !message || !signature) {
      return res.status(400).json({ error: 'Missing required fields: publicKey, message, signature' });
    }

    console.log('Solana auth attempt for public key:', publicKey);

    // Verify signature
    const messageBytes = new TextEncoder().encode(message);
    const publicKeyBytes = new PublicKey(publicKey).toBytes();
    const signatureBytes = new Uint8Array(signature);
    
    const isValidSignature = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );

    if (!isValidSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Для Solana аутентификации нам не нужна база данных!
    // Просто создаем пользователя на основе подписи кошелька
    const truncatedAddress = `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`;
    const userName = `Solana User ${truncatedAddress}`;
    const userEmail = `solana_${publicKey}@whatbird.app`;
    
    console.log('Solana authentication successful for:', userName);

    // For simplicity, we'll create a temporary token
    // In production, you should implement proper JWT token generation
    const tempToken = Buffer.from(JSON.stringify({
      userId: publicKey, // Используем public key как ID
      publicKey,
      email: userEmail,
      name: userName,
      authMethod: 'solana',
      timestamp: Date.now()
    })).toString('base64');

    // Set cookie
    res.cookie('access_token', tempToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000, // 1 hour
    });

    res.status(200).json({
      message: 'Solana authentication successful',
      user: {
        id: publicKey,
        name: userName,
        email: userEmail,
        solana_public_key: publicKey
      },
      access_token: tempToken
    });

  } catch (err) {
    console.error('Solana auth error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Маршрут для профиля (защищенный)
app.get('/profile', authenticateFlexible, async (req, res) => {
  try {
    console.log('Fetching profile for user:', req.user.email);
    
    // Для Solana пользователей используем данные из токена
    if (req.user.user_metadata?.auth_method === 'solana') {
      res.render('profile', { 
        user: {
          name: req.user.user_metadata.name,
          email: req.user.email,
          solana_public_key: req.user.user_metadata.solana_public_key
        },
        solanaConnected: true,
        authMethod: 'solana'
      });
      return;
    }

    // Для обычных пользователей ищем в базе данных
    const { data, error } = await supabase
      .from('profiles')
      .select('name, email, solana_public_key, auth_method')
      .eq('user_id', req.user.id)
      .single();

    if (error) throw new Error(error.message);

    res.render('profile', { 
      user: data,
      solanaConnected: !!data.solana_public_key,
      authMethod: data.auth_method || 'email'
    });
  } catch (err) {
    console.error('Profile fetch error:', err);
    res.status(500).redirect('/auth');
  }
});

const FormData = require('form-data');

// Endpoint for newland.tsx component
app.post('/api/newland-chat', upload.single('image'), async (req, res) => {
  const imageFile = req.file;
  const userMessage = req.body.message;
  const mode = req.body.mode || 'combined'; // Default to 'combined'
  const history = req.body.history ? JSON.parse(req.body.history) : [];

  const llmHistory = history.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.text
  }));

  try {
    // Mode 1: iNaturalist Only
    if (mode === 'inat') {
      if (!imageFile) {
        return res.status(400).json({ choices: [{ message: { content: '**Error:** iNaturalist mode requires an image.' } }] });
      }

      const apiToken = process.env.INATURALIST_API_TOKEN;
      if (!apiToken) throw new Error('INATURALIST_API_TOKEN is not configured');

      const form = new FormData();
      form.append('image', imageFile.buffer, { filename: imageFile.originalname });

      const response = await axios.post("https://api.inaturalist.org/v1/computervision/score_image?locale=en&preferred_place_id=1", form, {
        headers: { 'Authorization': apiToken, ...form.getHeaders() },
      });

      const data = response.data;
      const topResult = data.results?.[0];
      let formattedContent;

      if (!topResult) {
        formattedContent = "Could not identify the bird from the image. Please try another photo.";
      } else {
        const taxon = topResult.taxon;
        const commonName = taxon?.english_common_name || taxon?.default_name?.name || taxon?.preferred_common_name || taxon?.name;
        const latinName = taxon.name;
        const confidence = topResult.score ? (topResult.score * 100).toFixed(2) : null;
        const taxonImage = taxon.default_photo?.medium_url;

        formattedContent = `### ${commonName}\n`;
        formattedContent += `**Scientific Name:** *${latinName}*\n`;
        if (confidence) {
          formattedContent += `**Confidence:** ${confidence}%\n\n`;
        } else {
          formattedContent += `\n`;
        }
        if (taxonImage) {
          formattedContent += `![Image of ${commonName}](${taxonImage})\n\n`;
        }
      }
      return res.json({ choices: [{ message: { content: formattedContent } }] });
    }

    // Mode 2: Combined (Existing Logic)
    if (imageFile) {
      const apiToken = process.env.INATURALIST_API_TOKEN;
      if (!apiToken) throw new Error('INATURALIST_API_TOKEN is not configured');

      const form = new FormData();
      form.append('image', imageFile.buffer, { filename: imageFile.originalname });

      const response = await axios.post("https://api.inaturalist.org/v1/computervision/score_image?locale=en&preferred_place_id=1", form, {
        headers: { 'Authorization': apiToken, ...form.getHeaders() },
      });

      const data = response.data;
      const topResult = data.results?.[0];
      let formattedContent;

      if (!topResult) {
        formattedContent = "Could not identify the bird from the image. Please try another photo.";
      } else {
        const taxon = topResult.taxon;
        const commonName = taxon?.english_common_name || taxon?.default_name?.name || taxon?.preferred_common_name || taxon?.name;
        const latinName = taxon.name;
        const confidence = topResult.score ? (topResult.score * 100).toFixed(2) : null;
        const taxonImage = taxon.default_photo?.medium_url;

        formattedContent = `### ${commonName}\n`;
        formattedContent += `**Scientific Name:** *${latinName}*\n`;
        if (confidence) {
          formattedContent += `**Confidence:** ${confidence}%\n\n`;
        } else {
          formattedContent += `\n`;
        }
        if (taxonImage) {
          formattedContent += `![Image of ${commonName}](${taxonImage})\n\n`;
        }

        const llmSystemPrompt = `You are a bird expert. A bird has been identified for the user. Your task is to answer the user's follow-up question about this bird. If the user has not asked a specific question, provide a general description based on the user's desired format. Keep your answers concise and to the point.\n\nDesired format:\n- common description\n- Key visible features (color, shape, size, distinctive marks)`;
        let llmUserPrompt;
        if (userMessage && userMessage.trim().length > 0) {
          llmUserPrompt = `The bird has been identified as ${commonName} (${latinName}). The user has a specific question: \"${userMessage}\". Please answer it.`;
        } else {
          llmUserPrompt = `Tell me more about the ${commonName} (${latinName}).`;
        }

        const llmRequestBody = {
          model: "meta-llama/llama-4-scout:free",
          messages: [{ role: "system", content: llmSystemPrompt }, ...llmHistory, { role: "user", content: llmUserPrompt }]
        };

        const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(llmRequestBody)
        });

        if (llmResponse.ok) {
          const llmData = await llmResponse.json();
          formattedContent += `\n\n---\n\n${llmData.choices?.[0]?.message?.content || ''}`;
        }
      }
      res.json({ choices: [{ message: { content: formattedContent } }] });

    } else {
      // Text only
      if (!userMessage || userMessage.trim().length === 0) {
        return res.status(400).json({ error: 'No image or message provided' });
      }

      const llmSystemPrompt = `You are a bird expert. Answer the user's question about birds clearly and concisely. Keep your answers brief unless asked for more detail.`;
      const llmRequestBody = {
        model: "meta-llama/llama-4-scout:free",
        messages: [{ role: "system", content: llmSystemPrompt }, ...llmHistory, { role: "user", content: userMessage }]
      };

      const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(llmRequestBody)
      });

      if (!llmResponse.ok) {
        console.error('OpenRouter API error:', await llmResponse.text());
        throw new Error('Failed to get response from AI model.');
      }
      
      const llmData = await llmResponse.json();
      res.json(llmData);
    }
  } catch (error) {
    console.error('Error in POST /api/newland-chat:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    res.status(500).json({ choices: [{ message: { content: `**Error:** ${errorMessage}` } }] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));

module.exports = app;

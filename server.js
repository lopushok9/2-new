// Добавьте эти импорты в начало server.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // npm install jsonwebtoken

// Улучшенный endpoint для Solana аутентификации
app.post('/api/solana-auth', async (req, res) => {
  try {
    const { publicKey, message, signature } = req.body;
    
    if (!publicKey || !message || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
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

    // Check timestamp to prevent replay attacks
    const timestampMatch = message.match(/Timestamp: (\d+)/);
    if (!timestampMatch) {
      return res.status(400).json({ error: 'Invalid message format' });
    }
    
    const timestamp = parseInt(timestampMatch[1]);
    const currentTime = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (currentTime - timestamp > fiveMinutes) {
      return res.status(401).json({ error: 'Message expired' });
    }

    // Check if user exists
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('solana_public_key', publicKey)
      .single();

    let userId;
    let userEmail;
    let userName;

    if (!profile) {
      // Create new user
      const truncatedAddress = `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`;
      userEmail = `${publicKey.toLowerCase()}@solana.wallet`;
      userName = `Solana User ${truncatedAddress}`;
      
      // Generate secure random password
      const randomPassword = crypto.randomBytes(32).toString('hex');
      
      // Create user with Supabase Admin API
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: userEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          name: userName,
          solana_public_key: publicKey,
          auth_method: 'solana'
        }
      });

      if (createError) {
        console.error('User creation error:', createError);
        return res.status(500).json({ error: 'Failed to create user' });
      }

      userId = newUser.user.id;

      // Create profile
      const { error: profileCreateError } = await supabase
        .from('profiles')
        .insert([{
          user_id: userId,
          name: userName,
          email: userEmail,
          solana_public_key: publicKey
        }]);

      if (profileCreateError) {
        console.error('Profile creation error:', profileCreateError);
        // Try to cleanup the auth user
        await supabase.auth.admin.deleteUser(userId);
        return res.status(500).json({ error: 'Failed to create profile' });
      }
    } else {
      userId = profile.user_id;
      userEmail = profile.email;
      userName = profile.name;
    }

    // Create custom session token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession({
      userId: userId
    });

    if (sessionError || !sessionData.session) {
      // Fallback: create JWT manually
      const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
      if (!jwtSecret) {
        console.error('JWT_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }

      const token = jwt.sign(
        {
          sub: userId,
          email: userEmail,
          solana_public_key: publicKey,
          aud: 'authenticated',
          role: 'authenticated',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
        },
        jwtSecret
      );

      // Set cookie
      res.cookie('access_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000
      });

      return res.status(200).json({
        message: 'Solana authentication successful',
        user: {
          id: userId,
          name: userName,
          email: userEmail,
          solana_public_key: publicKey
        },
        access_token: token
      });
    }

    // Use Supabase session
    const accessToken = sessionData.session.access_token;
    
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000
    });

    res.status(200).json({
      message: 'Solana authentication successful',
      user: {
        id: userId,
        name: userName,
        email: userEmail,
        solana_public_key: publicKey
      },
      access_token: accessToken
    });

  } catch (err) {
    console.error('Solana auth error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Добавьте endpoint для обновления профиля Solana пользователя
app.put('/api/profile/solana', authenticate, async (req, res) => {
  try {
    const { name, email } = req.body;
    const userId = req.user.id;

    // Проверяем, что это Solana пользователь
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('solana_public_key')
      .eq('user_id', userId)
      .single();

    if (fetchError || !profile.solana_public_key) {
      return res.status(403).json({ error: 'Not a Solana wallet user' });
    }

    // Обновляем профиль
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ name, email })
      .eq('user_id', userId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update profile' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

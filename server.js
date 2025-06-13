const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));
app.use('/resources', express.static('resources'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Store captured cookies in memory (in production, use a database)
const capturedSessions = new Map();

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize authentication flow
app.post('/api/auth/init', (req, res) => {
  const sessionId = req.sessionID;
  capturedSessions.set(sessionId, { status: 'pending' });
  
  res.json({ 
    success: true, 
    authUrl: '/api/auth/login',
    sessionId: sessionId
  });
});

// Proxy login page
app.get('/api/auth/login', async (req, res) => {
  try {
    // Redirect to Fathom login with a callback URL
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/auth/callback`;
    res.redirect(`https://fathom.video/users/sign_in?return_to=${encodeURIComponent(callbackUrl)}`);
  } catch (error) {
    res.status(500).json({ error: 'Failed to initialize login' });
  }
});

// Callback endpoint that Fathom will redirect to after login
app.get('/api/auth/callback', async (req, res) => {
  // In a real implementation, we would need to handle OAuth flow or
  // implement a browser extension to capture cookies
  res.send(`
    <html>
      <body>
        <script>
          // This would need to be replaced with actual cookie capture logic
          // In a web app, we can't directly access third-party cookies due to browser security
          window.location.href = '/?loginComplete=true';
        </script>
      </body>
    </html>
  `);
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  const sessionId = req.sessionID;
  const session = capturedSessions.get(sessionId);
  
  res.json({
    authenticated: session?.status === 'completed',
    sessionId: sessionId
  });
});

// Save cookies endpoint (would be called by browser extension or other mechanism)
app.post('/api/auth/save-cookies', async (req, res) => {
  const { cookies, sessionId } = req.body;
  
  if (!cookies || !sessionId) {
    return res.status(400).json({ error: 'Missing cookies or sessionId' });
  }
  
  // Save to file system (matching Electron app behavior)
  const cookieDir = path.join(os.homedir(), 'temp_fathom_cookies');
  await fs.mkdir(cookieDir, { recursive: true });
  await fs.writeFile(
    path.join(cookieDir, 'session.json'),
    JSON.stringify(cookies, null, 2)
  );
  
  capturedSessions.set(sessionId, { 
    status: 'completed',
    cookies: cookies
  });
  
  res.json({ success: true });
});

// Proxy API calls to Fathom (example endpoint)
app.all('/api/fathom/*', async (req, res) => {
  const sessionId = req.sessionID;
  const session = capturedSessions.get(sessionId);
  
  if (!session || session.status !== 'completed') {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const fathomUrl = req.originalUrl.replace('/api/fathom', '');
    const cookieString = session.cookies
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
    
    const response = await axios({
      method: req.method,
      url: `https://fathom.video${fathomUrl}`,
      headers: {
        ...req.headers,
        'Cookie': cookieString,
        'Host': 'fathom.video'
      },
      data: req.body
    });
    
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to proxy request to Fathom' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
const path = require('path');
const { app, BrowserWindow, ipcMain, session } = require('electron');
const fs = require('fs');
const os = require('os');

// Load environment variables immediately, but handle both dev and prod paths
const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);
if (isDev) {
  // Development: try loading from project directory
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} else {
  // Production: load from resources
  const envPath = path.join(process.resourcesPath, '.env');
  if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
  }
}

const { google } = require('googleapis');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK - will be initialized after app ready
let db;

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret';
const REDIRECT_URI = 'http://localhost:8080/oauth/callback';

// Store current user email for session
let currentUserEmail = null;


function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('renderer.html');
}

app.whenReady().then(() => {
    console.log('CLIENT_ID loaded:', process.env.GOOGLE_CLIENT_ID ? 'FOUND' : 'NOT FOUND');
    
    // Initialize Firebase Admin SDK
    try {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const fullServiceAccountPath = isDev ? 
        path.join(__dirname, serviceAccountPath) : 
        path.join(process.resourcesPath, serviceAccountPath);
      
      if (serviceAccountPath && fs.existsSync(fullServiceAccountPath)) {
        const serviceAccount = require(path.resolve(fullServiceAccountPath));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log('[✓] Firebase initialized successfully');
      } else {
        console.error('[ERROR] Firebase service account file not found. Please set FIREBASE_SERVICE_ACCOUNT_PATH in .env');
      }
    } catch (error) {
      console.error('[ERROR] Failed to initialize Firebase:', error.message);
    }
    
    createWindow();
  });

// Step 1: Handle Google OAuth
ipcMain.handle('start-google-oauth', async (event) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/drive'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
  });

  // Navigate to Google OAuth URL in the same window
  mainWindow.loadURL(authUrl);
  
  // Hide Google's approval text
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      /* Hide "Approve Clicked" and similar Google OAuth messages */
      body > div:first-child:not([class]):not([id]) {
        display: none !important;
      }
    `);
  });

  return new Promise((resolve) => {
    let authComplete = false;

    const handleOAuthCallback = async (url) => {
      if (url.startsWith(REDIRECT_URI) && !authComplete) {
        authComplete = true;
        const urlParams = new URL(url);
        const code = urlParams.searchParams.get('code');
        
        if (code) {
          try {
            // Exchange code for tokens
            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            
            // Get user info
            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
            const userInfo = await oauth2.userinfo.get();
            
            // Prepare user data
            const userData = {
              name: userInfo.data.name,
              email: userInfo.data.email,
              googleCredentials: tokens,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            // Store current user email for later use
            currentUserEmail = userInfo.data.email;
            
            // Save to Firestore if available
            if (db) {
              try {
                await db.collection('users').doc(userInfo.data.email).set({
                  ...userData,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }, { merge: true });
                console.log(`[✓] Saved user data to Firestore: ${userData.name} (${userData.email})`);
              } catch (error) {
                console.error('[ERROR] Failed to save to Firestore:', error);
              }
            } else {
              console.warn('[WARN] Firestore not initialized, user data not persisted');
            }
            
            // Navigate back to the app with success parameter
            mainWindow.loadFile('renderer.html', { query: { googleAuth: 'complete' } });
            resolve({ success: true, userData });
          } catch (error) {
            console.error('[ERROR] OAuth token exchange failed:', error);
            mainWindow.loadFile('renderer.html', { query: { googleAuth: 'error' } });
            resolve({ success: false, error: error.message });
          }
        } else {
          console.error('[ERROR] No authorization code received');
          mainWindow.loadFile('renderer.html', { query: { googleAuth: 'error' } });
          resolve({ success: false, error: 'No authorization code' });
        }
      }
    };

    // Intercept navigation requests to handle OAuth callback
    mainWindow.webContents.on('will-navigate', async (event, url) => {
      console.log(`[INFO] OAuth navigation to: ${url}`);
      
      if (url.startsWith(REDIRECT_URI)) {
        // Prevent the navigation to localhost
        event.preventDefault();
        await handleOAuthCallback(url);
      }
    });

    // Also handle failed loads (when localhost refuses connection)
    mainWindow.webContents.on('did-fail-load', async (event, errorCode, errorDescription, validatedURL) => {
      if (validatedURL.startsWith(REDIRECT_URI)) {
        await handleOAuthCallback(validatedURL);
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!authComplete) {
        console.log('[!] Google OAuth timeout, returning to app');
        mainWindow.loadFile('renderer.html');
        resolve({ success: false, error: 'timeout' });
      }
    }, 300000);
  });
});

// Step 2: Handle Fathom login (modified to use stored username)
ipcMain.handle('start-login', async (event) => {
  const mainWindow = BrowserWindow.fromWebContents(event.sender);
  
  // Navigate to Fathom login in the same window
  mainWindow.loadURL('https://fathom.video/users/sign_in');

  return new Promise((resolve) => {
    let loginDetected = false;

    // Monitor URL changes to detect successful login
    mainWindow.webContents.on('did-navigate', async (event, url) => {
      console.log(`[INFO] Navigated to: ${url}`);
      
      // Check if we've reached the home page (successful login)
      if (url.includes('fathom.video/home') && !loginDetected) {
        loginDetected = true;
        console.log('[✓] Login successful, capturing cookies...');
        
        // Get cookies from the main session
        const cookies = await session.defaultSession.cookies.get({ domain: '.fathom.video' });
        
        // Save Fathom session to Firestore
        if (db && currentUserEmail) {
          try {
            const sessionData = {
              fathomCookies: cookies,
              fathomLoginTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            await db.collection('users').doc(currentUserEmail).update(sessionData);
            console.log(`[✓] Saved ${cookies.length} Fathom cookies to Firestore for user: ${currentUserEmail}`);
          } catch (error) {
            console.error('[ERROR] Failed to save Fathom session to Firestore:', error);
          }
        } else {
          console.warn('[WARN] Cannot save Fathom session - Firestore not initialized or user email not available');
        }
        
        // Navigate back to the app with success parameter
        mainWindow.loadFile('renderer.html', { query: { loginComplete: 'true' } });
        resolve('done');
      }
    });

    // Also monitor in-page navigations (for single-page apps)
    mainWindow.webContents.on('did-navigate-in-page', async (event, url) => {
      console.log(`[INFO] In-page navigation to: ${url}`);
      
      if (url.includes('fathom.video/home') && !loginDetected) {
        loginDetected = true;
        console.log('[✓] Login successful, capturing cookies...');
        
        const cookies = await session.defaultSession.cookies.get({ domain: '.fathom.video' });
        
        // Save Fathom session to Firestore
        if (db && currentUserEmail) {
          try {
            const sessionData = {
              fathomCookies: cookies,
              fathomLoginTimestamp: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            await db.collection('users').doc(currentUserEmail).update(sessionData);
            console.log(`[✓] Saved ${cookies.length} Fathom cookies to Firestore for user: ${currentUserEmail}`);
          } catch (error) {
            console.error('[ERROR] Failed to save Fathom session to Firestore:', error);
          }
        } else {
          console.warn('[WARN] Cannot save Fathom session - Firestore not initialized or user email not available');
        }
        
        mainWindow.loadFile('renderer.html');
        resolve('done');
      }
    });

    // Fallback timeout after 5 minutes
    setTimeout(() => {
      if (!loginDetected) {
        console.log('[!] Login timeout, returning to app');
        mainWindow.loadFile('renderer.html');
        resolve('timeout');
      }
    }, 300000);
  });
});

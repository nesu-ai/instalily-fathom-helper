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

// Initialize secure local storage - will be initialized after app ready
let store;

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret';
const REDIRECT_URI = 'http://localhost:48484/oauth/callback';

// Store current user email for session
let currentUserEmail = null;

// Check for existing user session and validate with Firestore
async function checkExistingSession() {
  if (!store) {
    console.log('[INFO] Store not initialized yet');
    return null;
  }
  
  try {
    // Get stored session
    const storedSession = store.get('userSession');
    
    if (!storedSession || !storedSession.email) {
      console.log('[INFO] No local session found');
      return null;
    }
    
    console.log(`[INFO] Found local session for: ${storedSession.email}`);
    
    // Check with Firestore if credentials need updating
    if (db) {
      try {
        const userDoc = await db.collection('users').doc(storedSession.email).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          
          // Check if credentials need updating
          if (userData.needsUpdatedGoogleCredentials === true) {
            console.log('[INFO] User needs to update Google credentials, clearing local session');
            store.delete('userSession');
            return null;
          }
          
          if (userData.needsUpdatedFathomCredentials === true) {
            console.log('[INFO] User needs to update Fathom credentials, clearing Fathom data only');
            const currentSession = store.get('userSession');
            if (currentSession) {
              // Keep Google auth but clear Fathom data
              currentSession.fathomCookies = [];
              store.set('userSession', currentSession);
              // Return session data indicating Google is connected but Fathom needs reconnection
              return {
                email: currentSession.email,
                name: currentSession.name,
                picture: currentSession.picture,
                hasGoogleAuth: !!currentSession.googleCredentials,
                hasFathomAuth: false
              };
            }
          }
        }
      } catch (error) {
        console.error('[ERROR] Failed to check Firestore for credential status:', error);
        // Continue with local session if Firestore check fails
      }
    }
    
    // Session is valid
    currentUserEmail = storedSession.email;
    
    return {
      email: storedSession.email,
      name: storedSession.name,
      picture: storedSession.picture,
      hasGoogleAuth: !!storedSession.googleCredentials,
      hasFathomAuth: !!storedSession.fathomCookies && storedSession.fathomCookies.length > 0
    };
  } catch (error) {
    console.error('[ERROR] Failed to check existing session:', error);
    return null;
  }
}

// Save user session locally
async function saveUserSession(userData) {
  if (!store) {
    console.log('[WARN] Store not initialized, cannot save session');
    return;
  }
  
  try {
    const sessionData = {
      email: userData.email,
      name: userData.name,
      picture: userData.picture,
      googleCredentials: userData.googleCredentials,
      fathomCookies: userData.fathomCookies || [],
      lastUpdated: new Date().toISOString()
    };
    
    store.set('userSession', sessionData);
    console.log(`[✓] Saved user session locally for: ${userData.email}`);
  } catch (error) {
    console.error('[ERROR] Failed to save user session locally:', error);
  }
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 600,
    height: 800,
    icon: path.join(__dirname, 'resources/logos/InstalilyFathomHelperLogo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Check for existing session before loading
  const existingSession = await checkExistingSession();
  
  if (existingSession) {
    // Pass session data to renderer via query parameters
    win.loadFile('renderer.html', { 
      query: { 
        sessionData: JSON.stringify(existingSession)
      } 
    });
  } else {
    win.loadFile('renderer.html');
  }
}

app.whenReady().then(async () => {
    console.log('CLIENT_ID loaded:', process.env.GOOGLE_CLIENT_ID ? 'FOUND' : 'NOT FOUND');
    
    // Initialize electron-store
    try {
      const Store = (await import('electron-store')).default;
      store = new Store({
        encryptionKey: 'instalily-fathom-helper-secure-key', // In production, use a more secure key
        schema: {
          userSession: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              name: { type: 'string' },
              picture: { type: 'string' },
              googleCredentials: { type: 'object' },
              fathomCookies: { type: 'array' },
              lastUpdated: { type: 'string' }
            }
          }
        }
      });
      console.log('[✓] Electron-store initialized successfully');
    } catch (error) {
      console.error('[ERROR] Failed to initialize electron-store:', error);
    }
    
    // Initialize Firebase Admin SDK
    try {
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      
      if (serviceAccountJson) {
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log('[✓] Firebase initialized successfully');
      } else {
        console.error('[ERROR] Firebase service account JSON not found. Please set FIREBASE_SERVICE_ACCOUNT_JSON in .env');
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
              picture: userInfo.data.picture,
              googleCredentials: tokens,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            // Store current user email for later use
            currentUserEmail = userInfo.data.email;
            
            // Save user session locally
            await saveUserSession(userData);
            
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
            
            // Navigate back to the app with session data
            const sessionData = {
              email: userData.email,
              name: userData.name,
              picture: userData.picture,
              hasGoogleAuth: true,
              hasFathomAuth: false
            };
            mainWindow.loadFile('renderer.html', { 
              query: { 
                sessionData: JSON.stringify(sessionData)
              } 
            });
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
      if ((url.includes('fathom.video/home') || url.includes('fathom.video/onboarding/customize/auto_record')) && !loginDetected) {
        loginDetected = true;
        console.log('[✓] Login successful, capturing cookies...');
        
        // Get cookies from the main session
        const cookies = await session.defaultSession.cookies.get({ domain: '.fathom.video' });
        
        // Update local session with Fathom cookies
        if (store) {
          const currentSession = store.get('userSession');
          if (currentSession) {
            currentSession.fathomCookies = cookies;
            currentSession.lastUpdated = new Date().toISOString();
            store.set('userSession', currentSession);
            console.log(`[✓] Updated local session with ${cookies.length} Fathom cookies`);
          }
        }
        
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
        
        // Navigate back to the app with updated session data
        const currentSessionData = store ? store.get('userSession') : null;
        if (currentSessionData) {
          const sessionData = {
            email: currentSessionData.email,
            name: currentSessionData.name,
            picture: currentSessionData.picture,
            hasGoogleAuth: true,
            hasFathomAuth: true
          };
          mainWindow.loadFile('renderer.html', { 
            query: { 
              sessionData: JSON.stringify(sessionData)
            } 
          });
        } else {
          mainWindow.loadFile('renderer.html');
        }
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
        
        // Update local session with Fathom cookies
        if (store) {
          const currentSession = store.get('userSession');
          if (currentSession) {
            currentSession.fathomCookies = cookies;
            currentSession.lastUpdated = new Date().toISOString();
            store.set('userSession', currentSession);
            console.log(`[✓] Updated local session with ${cookies.length} Fathom cookies`);
          }
        }
        
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
        
        // Navigate back to the app with updated session data
        const currentSessionData = store ? store.get('userSession') : null;
        if (currentSessionData) {
          const sessionData = {
            email: currentSessionData.email,
            name: currentSessionData.name,
            picture: currentSessionData.picture,
            hasGoogleAuth: true,
            hasFathomAuth: true
          };
          mainWindow.loadFile('renderer.html', { 
            query: { 
              sessionData: JSON.stringify(sessionData)
            } 
          });
        } else {
          mainWindow.loadFile('renderer.html');
        }
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

// IPC Handler: Check current session
ipcMain.handle('check-session', async () => {
  return await checkExistingSession();
});

// IPC Handler: Logout (clear local data only)
ipcMain.handle('logout', async () => {
  try {
    // Clear local session
    if (store) {
      store.delete('userSession');
    }
    currentUserEmail = null;
    
    console.log('[✓] Local session cleared');
    return { success: true };
  } catch (error) {
    console.error('[ERROR] Failed to logout:', error);
    return { success: false, error: error.message };
  }
});

// IPC Handler: Close app
ipcMain.handle('close-app', () => {
  app.quit();
});
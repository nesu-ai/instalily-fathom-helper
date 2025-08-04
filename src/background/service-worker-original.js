// Firebase imports for direct Firestore access
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithCredential, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA9S5h5YtgyH7cV2VKSjSp2HHB8kaPzRAA",
  authDomain: "instalily-sales.firebaseapp.com",
  projectId: "instalily-sales",
  storageBucket: "instalily-sales.appspot.com",
  messagingSenderId: "940153812799",
  appId: "1:940153812799:web:e7fs83fgm2v3cs7jsd7afe"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Track Firebase Auth state
let currentFirebaseUser = null;

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('✅ Firebase Auth user signed in:', user.uid);
    currentFirebaseUser = user;
  } else {
    console.log('❌ No Firebase Auth user');
    currentFirebaseUser = null;
  }
});

console.log('Service worker starting with Firebase initialized...');

// DEV MODE: Skip auth for development
const DEV_MODE = false; // Set to false for production

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('🔍 DEBUG: Extension installed successfully');
  console.log('🔍 DEBUG: Extension ID:', chrome.runtime.id);
  console.log('🔍 DEBUG: Expected Extension ID: lnmpcocpniinngojickkbnajgijjmloi');
  console.log('🔍 DEBUG: Required redirect URI:', `https://${chrome.runtime.id}.chromiumapp.org/`);
  console.log('🔍 DEBUG: Manifest OAuth2 config:', chrome.runtime.getManifest().oauth2);
  
  // Verify the extension ID matches expected
  if (chrome.runtime.id !== 'lnmpcocgniniingojickbnajgijjmloi') {
    console.warn('⚠️ Extension ID mismatch!');
    console.warn('⚠️ Current:', chrome.runtime.id);
    console.warn('⚠️ Expected: lnmpcocpniinngojickbnajgijjmloi');
    console.warn('⚠️ Update OAuth client redirect URI to:', `https://${chrome.runtime.id}.chromiumapp.org/`);
  } else {
    console.log('✅ Extension ID matches expected value');
  }
  
  // Try to enable side panel if supported
  try {
    if (chrome.sidePanel) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      chrome.sidePanel.setOptions({
        path: 'popup/popup.html',
        enabled: true
      });
      console.log('✅ Side panel configured');
    } else {
      console.log('ℹ️ Side panel not supported, using popup fallback');
    }
  } catch (error) {
    console.log('ℹ️ Side panel setup failed, using popup fallback:', error);
  }
});

// Note: Action click is handled automatically by:
// - Side panel in Chrome (when sidePanel.setPanelBehavior({ openPanelOnActionClick: true }) is set)
// - Default popup in Arc and other browsers (via manifest.json default_popup)

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request.type);
  
  if (request.type === 'GET_AUTH_STATUS') {
    // DEV MODE: Return mock authenticated user
    if (DEV_MODE) {
      console.log('🚀 DEV MODE: Returning mock authenticated user');
      sendResponse({
        isAuthenticated: true,
        user: {
          name: 'Dev User',
          email: 'dev@instalily.ai',
          picture: 'https://via.placeholder.com/48',
          googleToken: 'mock-dev-token'
        },
        platforms: {
          fathom: { enabled: false, connected: false },
          circleback: { enabled: false, connected: false },
          fireflies: { enabled: false, connected: false },
          zoom: { enabled: false, connected: false }
        }
      });
      return;
    }
    
    getAuthStatus().then(sendResponse).catch(error => {
      sendResponse({ isAuthenticated: false, error: error.message });
    });
    return true; // Async response
  }
  
  if (request.type === 'START_GOOGLE_AUTH') {
    // Manual OAuth flow using popup
    startGoogleOAuthFlow().then(sendResponse).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
  
  if (request.type === 'LOGOUT') {
    handleLogout().then(sendResponse).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
  
  if (request.type === 'LOGIN_DETECTED') {
    handlePlatformLogin(request.platform).then(sendResponse).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
  
  if (request.type === 'REMOVE_SERVICE') {
    handleServiceRemoval(request.serviceId).then(sendResponse).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
  
  if (request.type === 'OAUTH_SUCCESS') {
    // Handle OAuth success from injected script
    console.log('OAuth success received from injected script');
    // Store the data globally so the OAuth flow can access it
    globalThis.oauthResult = { success: true, data: request.data };
    return true;
  }
  
  if (request.type === 'OAUTH_ERROR') {
    // Handle OAuth error from injected script
    console.log('OAuth error received from injected script');
    globalThis.oauthResult = { success: false, error: request.error };
    return true;
  }
});

// Handle logout
async function handleLogout() {
  try {
    console.log('Starting logout process...');
    
    // Get stored user data before clearing
    const stored = await chrome.storage.local.get(['user']);
    console.log('Current stored user:', stored.user ? 'Found' : 'None');
    
    // Clear Chrome identity token cache first
    if (stored.user && stored.user.googleToken) {
      try {
        console.log('Removing cached auth token...');
        await new Promise((resolve, reject) => {
          chrome.identity.removeCachedAuthToken(
            { token: stored.user.googleToken },
            () => {
              if (chrome.runtime.lastError) {
                console.warn('Token removal warning:', chrome.runtime.lastError);
                // Don't fail logout for token removal issues
              }
              console.log('Cached token removed');
              resolve();
            }
          );
        });
      } catch (tokenError) {
        console.warn('Could not remove cached token:', tokenError);
        // Continue with logout even if token removal fails
      }
    }
    
    // Clear all identity tokens
    try {
      console.log('Clearing all cached auth tokens...');
      await new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          if (chrome.runtime.lastError) {
            console.warn('Clear all tokens warning:', chrome.runtime.lastError);
          }
          console.log('All cached tokens cleared');
          resolve();
        });
      });
    } catch (clearError) {
      console.warn('Could not clear all cached tokens:', clearError);
    }
    
    // Clear all local storage after token cleanup
    console.log('Clearing all local storage...');
    await chrome.storage.local.clear();
    
    // Verify storage is cleared
    const verifyCleared = await chrome.storage.local.get(null);
    console.log('Storage after clear:', Object.keys(verifyCleared).length === 0 ? 'Empty' : 'Still has data', verifyCleared);
    
    console.log('User logged out successfully - all data cleared');
    return { success: true };
  } catch (error) {
    console.error('Error during logout:', error);
    return { success: false, error: error.message };
  }
}

// Chrome Identity API OAuth flow with backend token exchange
async function startGoogleOAuthFlow() {
  try {
    console.log('🔍 DEBUG: Starting Chrome Identity API OAuth flow...');
    console.log('🔍 DEBUG: Extension ID:', chrome.runtime.id);
    console.log('🔍 DEBUG: Manifest OAuth2 config:', chrome.runtime.getManifest().oauth2);
    
    // OAuth configuration
    const CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;
    const REDIRECT_URI = chrome.identity.getRedirectURL();
    const SCOPES = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file'
    ].join(' ');
    
    console.log('🔍 DEBUG: Redirect URI:', REDIRECT_URI);
    
    // Build the OAuth URL with parameters for refresh token
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(SCOPES)}` +
      `&access_type=offline` +     // Request refresh token
      `&prompt=consent`;            // Force consent to ensure refresh token
    
    return new Promise((resolve, reject) => {
      console.log('🔍 DEBUG: Launching web auth flow...');
      
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true
        },
        async (redirectUrl) => {
          console.log('🔍 DEBUG: Web auth flow callback triggered');
          console.log('🔍 DEBUG: Redirect URL:', redirectUrl);
          
          if (chrome.runtime.lastError) {
            console.error('❌ Chrome Identity API error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (!redirectUrl) {
            console.error('❌ No redirect URL received');
            reject(new Error('Authorization was cancelled or failed'));
            return;
          }
          
          try {
            // Extract authorization code from redirect URL
            const url = new URL(redirectUrl);
            const code = url.searchParams.get('code');
            
            if (!code) {
              throw new Error('No authorization code received');
            }
            
            console.log('✅ Got authorization code');
            
            // Send code to backend server for token exchange
            console.log('🔍 DEBUG: Sending code to backend for token exchange...');
            const AUTH_SERVICE_URL = 'https://discovery-service-940153812799.us-central1.run.app';
            
            const tokenResponse = await fetch(`${AUTH_SERVICE_URL}/auth/exchange-code`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                code: code,
                redirect_uri: REDIRECT_URI
              })
            });
            
            if (!tokenResponse.ok) {
              const errorText = await tokenResponse.text();
              console.error('❌ Backend token exchange failed:', tokenResponse.status, errorText);
              throw new Error(`Backend token exchange failed: ${tokenResponse.status}`);
            }
            
            const tokenData = await tokenResponse.json();
            console.log('✅ Got tokens from backend:', {
              access_token: tokenData.access_token ? 'present' : 'missing',
              refresh_token: tokenData.refresh_token ? 'present' : 'missing',
              user_info: tokenData.user_info ? 'present' : 'missing'
            });
            
            // Process the tokens using existing flow
            const result = await handleBackendTokens(tokenData);
            
            resolve(result);
            
          } catch (error) {
            console.error('❌ Failed to process OAuth flow:', error);
            reject(error);
          }
        }
      );
    });
    
  } catch (error) {
    console.error('❌ Chrome Identity OAuth flow failed:', error);
    throw error;
  }
}

// Helper function to refresh access token using backend service
async function refreshAccessToken() {
  try {
    console.log('Refreshing access token through backend...');
    
    // Get stored user data with Firebase UID
    const stored = await chrome.storage.local.get(['user']);
    if (!stored.user || !stored.user.firebaseUid) {
      throw new Error('No user data available for refresh');
    }
    
    const AUTH_SERVICE_URL = 'https://discovery-service-940153812799.us-central1.run.app';
    
    // Request token refresh from backend
    const response = await fetch(`${AUTH_SERVICE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: stored.user.email,
        firebase_uid: stored.user.firebaseUid
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh access token');
    }
    
    const tokenData = await response.json();
    console.log('✅ Access token refreshed successfully');
    
    // Update stored user with new access token
    stored.user.googleToken = tokenData.access_token;
    await chrome.storage.local.set({ user: stored.user });
    
    return tokenData.access_token;
    
  } catch (error) {
    console.error('❌ Failed to refresh access token:', error);
    // If refresh fails, user needs to re-authenticate
    await chrome.storage.local.remove(['user']);
    throw error;
  }
}

// Handle tokens received from OAuth flow
async function handleBackendTokens(data) {
  try {
    console.log('Processing tokens from OAuth flow...');
    
    const { access_token, refresh_token, user_info } = data;
    
    if (!access_token || !user_info) {
      throw new Error('Missing access token or user info');
    }
    
    // Sign in to Firebase Auth using the access token
    console.log('Signing in to Firebase Auth with Google credential...');
    const credential = GoogleAuthProvider.credential(null, access_token);
    const userCredential = await signInWithCredential(auth, credential);
    const firebaseUser = userCredential.user;
    
    console.log('✅ Firebase Auth sign-in successful:', firebaseUser.uid);
    
    // Prepare user info for local storage
    const userInfo = {
      id: user_info.id,
      email: user_info.email,
      name: user_info.name,
      picture: user_info.picture,
      firebaseUid: firebaseUser.uid,
      googleToken: access_token
    };
    
    // Store user data locally
    await chrome.storage.local.set({ user: userInfo });
    
    // Handle user in Firestore with refresh token
    await handleUserFirestore(userInfo, access_token, refresh_token);
    
    console.log('✅ User authenticated and stored locally');
    
    return {
      success: true,
      user: userInfo,
      token: access_token,
      refreshToken: refresh_token,
      firebaseUser: firebaseUser
    };
    
  } catch (error) {
    console.error('❌ Error processing OAuth tokens:', error);
    throw error;
  }
}


// Get current authentication status
async function getAuthStatus() {
  try {
    console.log('Checking auth status...');
    const stored = await chrome.storage.local.get(['user']);
    
    if (stored.user) {
      console.log('Found user in storage:', stored.user);
      
      // Try to sync platforms from Firestore if we have a token
      if (stored.user.googleToken) {
        try {
          await syncUserDataFromFirestore(stored.user);
        } catch (error) {
          console.log('Could not sync from Firestore on startup:', error);
        }
      }
      
      // Get platforms status (might be updated from Firestore sync)
      const platformsData = await chrome.storage.local.get(['platforms']);
      return {
        isAuthenticated: true,
        user: stored.user,
        platforms: platformsData.platforms || {}
      };
    }
    
    console.log('No user found in storage');
    return {
      isAuthenticated: false,
      platforms: {}
    };
  } catch (error) {
    console.error('Error checking auth status:', error);
    return {
      isAuthenticated: false,
      error: error.message
    };
  }
}

// Handle platform login detection
async function handlePlatformLogin(platform) {
  try {
    console.log(`Platform login detected: ${platform}`);
    
    // Get current storage
    const stored = await chrome.storage.local.get(['platforms']);
    const platforms = stored.platforms || {};
    
    // Extract cookies for the platform - get all related domains
    let cookies = [];
    let domains = [];
    
    switch(platform) {
      case 'fathom':
        domains = ['fathom.video', '.fathom.video', 'app.fathom.video', 'api.fathom.video'];
        break;
      case 'circleback':
        domains = ['circleback.ai', '.circleback.ai', 'app.circleback.ai', 'api.circleback.ai'];
        break;
      case 'fireflies':
        domains = ['fireflies.ai', '.fireflies.ai', 'app.fireflies.ai', 'api.fireflies.ai'];
        break;
      case 'zoom':
        domains = ['zoom.us', '.zoom.us', 'us02web.zoom.us', 'us04web.zoom.us', 'us05web.zoom.us'];
        break;
    }
    
    if (domains.length > 0) {
      // Get all cookies for all related domains
      const allCookiePromises = domains.map(domain => 
        chrome.cookies.getAll({ domain }).catch(err => {
          console.log(`Could not get cookies for domain ${domain}:`, err);
          return [];
        })
      );
      
      const cookieArrays = await Promise.all(allCookiePromises);
      
      // Flatten and deduplicate cookies
      const allCookies = cookieArrays.flat();
      const uniqueCookies = new Map();
      
      allCookies.forEach(cookie => {
        const key = `${cookie.name}-${cookie.domain}-${cookie.path}`;
        uniqueCookies.set(key, cookie);
      });
      
      cookies = Array.from(uniqueCookies.values());
      console.log(`Found ${cookies.length} total cookies for ${platform} across ${domains.length} domains`);
      
      // Log breakdown by domain
      domains.forEach(domain => {
        const domainCookies = cookies.filter(c => c.domain === domain || c.domain === `.${domain}`);
        if (domainCookies.length > 0) {
          console.log(`  - ${domain}: ${domainCookies.length} cookies`);
        }
      });
    }
    
    // Convert cookies to an array format suitable for Firestore
    const cookieData = cookies.map(cookie => {
      // Filter out undefined values that Firestore doesn't support
      const cookieInfo = {
        name: cookie.name || '',
        value: cookie.value || '',
        domain: cookie.domain || '',
        path: cookie.path || '/',
        secure: cookie.secure || false,
        httpOnly: cookie.httpOnly || false,
        sameSite: cookie.sameSite || 'unspecified',
        session: cookie.session || false
      };
      
      // Only include expirationDate if it's defined
      if (cookie.expirationDate !== undefined) {
        cookieInfo.expirationDate = cookie.expirationDate;
      }
      
      return cookieInfo;
    });
    
    // Update platforms status
    platforms[platform] = {
      connected: true,
      connecting: false, // Clear connecting state
      connectedAt: new Date().toISOString(),
      cookieCount: cookies.length,
      cookies: cookieData
    };
    
    // Save to storage
    await chrome.storage.local.set({ platforms });
    
    // Update Firestore with platform connection and cookies
    await updatePlatformInFirestore(platform, platforms[platform]);
    
    console.log(`${platform} connected successfully`);
    return { success: true, platform };
  } catch (error) {
    console.error(`Error handling ${platform} login:`, error);
    return { success: false, error: error.message };
  }
}

// Handle user creation/update in Firestore using Firebase SDK
async function handleUserFirestore(userInfo, accessToken, refreshToken = null) {
  try {
    console.log('=== FIRESTORE USER HANDLING ===');
    console.log('User info:', {
      googleId: userInfo.id,
      firebaseUid: userInfo.firebaseUid,
      email: userInfo.email,
      name: userInfo.name
    });
    
    // Use email as the document ID for easier identification
    const userId = userInfo.email;
    
    console.log('Using document ID:', userId);
    
    const now = new Date().toISOString();
    
    // Prepare user document structure matching the schema from images
    const userDoc = {
      createdAt: now,
      email: userInfo.email,
      name: userInfo.name,
      googleId: userInfo.id, // Store original Google ID separately
      firebaseUid: userInfo.firebaseUid, // Store Firebase UID
      googleCredentials: {
        access_token: accessToken,
        expiry_date: Date.now() + (3600 * 1000),
        id_token: userInfo.id || null,
        refresh_token: refreshToken,
        scope: "openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file",
        token_type: "Bearer"
      },
      platforms: {
        circleback: {
          enabled: false,
          lastFullRediscoverAt: null,
          lastScrapedAt: null,
          needsFullRediscover: false,
          needsUpdatedCredentials: false
        },
        fathom: {
          enabled: false,
          lastFullRediscoverAt: null,
          lastScrapedAt: null,
          needsFullRediscover: false,
          needsUpdatedCredentials: false
        },
        fireflies: {
          enabled: false,
          lastFullRediscoverAt: null,
          lastScrapedAt: null,
          needsFullRediscover: false,
          needsUpdatedCredentials: false
        },
        zoom: {
          enabled: false,
          lastFullRediscoverAt: null,
          lastScrapedAt: null,
          needsFullRediscover: false,
          needsUpdatedCredentials: false
        }
      },
      preferences: {
        driveParentFolderId: null,
        enabledDriveUpload: true
      },
      updatedAt: now
    };
    
    try {
      console.log('Saving user to Firestore using Firebase Auth UID:', userId);
      
      // Reference to user document using Firebase Auth UID
      const userDocRef = doc(db, 'users', userId);
      
      // Check if user exists
      const userSnapshot = await getDoc(userDocRef);
      
      if (userSnapshot.exists()) {
        // User exists, update credentials and updatedAt
        console.log('User exists, updating...');
        await updateDoc(userDocRef, {
          updatedAt: now,
          googleCredentials: userDoc.googleCredentials
        });
        
        // Get the updated document
        const updatedSnapshot = await getDoc(userDocRef);
        const existingData = updatedSnapshot.data();
        
        console.log('✅ User updated successfully in Firestore');
        return existingData;
      } else {
        // User doesn't exist, create new document
        console.log('Creating new user in Firestore...');
        await setDoc(userDocRef, userDoc);
        
        console.log('✅ User created successfully in Firestore');
        return userDoc;
      }
      
    } catch (firestoreError) {
      console.error('❌ Firestore operation failed:', firestoreError);
      console.error('Error details:', firestoreError.message);
      
      // Store locally as fallback
      await chrome.storage.local.set({ 
        userData: userDoc,
        firestorePending: true 
      });
      
      return userDoc;
    }
    
  } catch (error) {
    console.error('❌ Error handling user data:', error);
    return null;
  }
}

// Convert JavaScript object to Firestore field format
function convertToFirestoreFormat(obj) {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === null) {
      result[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      result[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      result[key] = { integerValue: value.toString() };
    } else if (typeof value === 'boolean') {
      result[key] = { booleanValue: value };
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      result[key] = { mapValue: { fields: convertToFirestoreFormat(value) } };
    } else if (Array.isArray(value)) {
      result[key] = { 
        arrayValue: { 
          values: value.map(item => 
            typeof item === 'object' ? 
            { mapValue: { fields: convertToFirestoreFormat(item) } } :
            { stringValue: item.toString() }
          ) 
        }
      };
    }
  }
  
  return result;
}

// Update platform status in Firestore using Firebase SDK
async function updatePlatformInFirestore(platformId, platformData) {
  try {
    console.log(`🔍 Starting Firestore update for platform: ${platformId}`);
    
    // Get current user
    const stored = await chrome.storage.local.get(['user']);
    if (!stored.user) {
      console.error('❌ No user available for Firestore update');
      return;
    }
    
    const { user } = stored;
    console.log(`🔍 User found:`, {
      email: user.email,
      firebaseUid: user.firebaseUid,
      hasGoogleToken: !!user.googleToken
    });
    
    // Check Firebase Auth state
    console.log(`🔍 Current Firebase Auth user:`, currentFirebaseUser ? {
      uid: currentFirebaseUser.uid,
      email: currentFirebaseUser.email
    } : 'No Firebase user');
    
    // Use email as document ID for consistency
    const userId = user.email;
    console.log(`🔍 Using document ID: ${userId}`);
    
    // Reference to user document using Firebase Auth UID
    const userDocRef = doc(db, 'users', userId);
    console.log(`🔍 Document reference created for: users/${userId}`);
    
    // Prepare platform update
    const platformUpdate = {
      enabled: true,
      lastScrapedAt: new Date().toISOString(),
      needsUpdatedCredentials: true,
      needsFullRediscover: true,
      cookies: platformData.cookies || {}
    };
    
    console.log(`🔍 Platform update data:`, {
      platformId,
      enabled: platformUpdate.enabled,
      cookieCount: Object.keys(platformUpdate.cookies).length,
      hasLastScrapedAt: !!platformUpdate.lastScrapedAt
    });
    
    // Update the specific platform in the platforms map
    const updateData = {
      [`platforms.${platformId}`]: platformUpdate,
      updatedAt: new Date().toISOString()
    };
    
    console.log(`🔍 Attempting Firestore updateDoc with:`, updateData);
    
    await updateDoc(userDocRef, updateData);
    
    console.log(`✅ Platform ${platformId} updated successfully in Firestore`);
    
    // Verify the update by reading back
    try {
      const updatedDoc = await getDoc(userDocRef);
      if (updatedDoc.exists()) {
        const data = updatedDoc.data();
        const updatedPlatform = data.platforms?.[platformId];
        console.log(`🔍 Verification - Platform ${platformId} in Firestore:`, {
          enabled: updatedPlatform?.enabled,
          cookieCount: updatedPlatform?.cookies ? Object.keys(updatedPlatform.cookies).length : 0,
          lastScrapedAt: updatedPlatform?.lastScrapedAt
        });
      } else {
        console.error(`❌ Verification failed - Document does not exist: users/${userId}`);
      }
    } catch (verifyError) {
      console.error('❌ Error verifying Firestore update:', verifyError);
    }
    
  } catch (error) {
    console.error('❌ Error updating platform in Firestore:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
}

// Convert Firestore field format back to JavaScript object
function convertFromFirestoreFormat(firestoreFields) {
  if (!firestoreFields) return null;
  
  const result = {};
  
  for (const [key, value] of Object.entries(firestoreFields)) {
    if (value.nullValue !== undefined) {
      result[key] = null;
    } else if (value.stringValue !== undefined) {
      result[key] = value.stringValue;
    } else if (value.integerValue !== undefined) {
      result[key] = parseInt(value.integerValue);
    } else if (value.booleanValue !== undefined) {
      result[key] = value.booleanValue;
    } else if (value.mapValue && value.mapValue.fields) {
      result[key] = convertFromFirestoreFormat(value.mapValue.fields);
    } else if (value.arrayValue && value.arrayValue.values) {
      result[key] = value.arrayValue.values.map(item => {
        if (item.mapValue && item.mapValue.fields) {
          return convertFromFirestoreFormat(item.mapValue.fields);
        }
        return item.stringValue || item.integerValue || item.booleanValue || item;
      });
    }
  }
  
  return result;
}

// Sync platforms from Firestore to local storage
async function syncPlatformsFromFirestore(firestorePlatforms) {
  try {
    console.log('Syncing platforms from Firestore:', firestorePlatforms);
    
    // Get current local platforms
    const stored = await chrome.storage.local.get(['platforms']);
    const localPlatforms = stored.platforms || {};
    
    // Convert Firestore platforms to local format
    const syncedPlatforms = {};
    
    for (const [platformId, platformData] of Object.entries(firestorePlatforms)) {
      if (platformData && platformData.enabled) {
        syncedPlatforms[platformId] = {
          connected: true,
          connectedAt: platformData.lastScrapedAt || new Date().toISOString(),
          cookieCount: platformData.cookies ? Object.keys(platformData.cookies).length : 0,
          needsUpdate: platformData.needsUpdatedCredentials || false
        };
      }
    }
    
    // Merge with any local platforms
    const mergedPlatforms = { ...localPlatforms, ...syncedPlatforms };
    
    // Save back to local storage
    await chrome.storage.local.set({ platforms: mergedPlatforms });
    
    console.log('Platforms synced successfully:', mergedPlatforms);
    
  } catch (error) {
    console.error('Error syncing platforms from Firestore:', error);
  }
}

// Sync user data from Firestore on startup/auth check using Firebase SDK
async function syncUserDataFromFirestore(user) {
  try {
    console.log('Syncing user data from Firestore using Firebase SDK...');
    
    // Use email as document ID for consistency
    const userId = user.email;
    
    // Reference to user document using Firebase Auth UID
    const userDocRef = doc(db, 'users', userId);
    
    // Get user document
    const userSnapshot = await getDoc(userDocRef);
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.data();
      console.log('User found in Firestore, syncing platforms...');
      
      // Sync platforms if they exist
      if (userData.platforms) {
        await syncPlatformsFromFirestore(userData.platforms);
      }
    } else {
      console.log('User not found in Firestore');
    }
    
  } catch (error) {
    console.error('Error syncing user data from Firestore:', error);
  }
}

// Handle service removal
async function handleServiceRemoval(serviceId) {
  try {
    console.log(`Removing service: ${serviceId}`);
    
    // Get current storage
    const stored = await chrome.storage.local.get(['platforms']);
    const platforms = stored.platforms || {};
    
    // Remove from local storage
    if (platforms[serviceId]) {
      delete platforms[serviceId];
      await chrome.storage.local.set({ platforms });
      console.log(`Removed ${serviceId} from local storage`);
    }
    
    // Remove from Firestore
    await removeServiceFromFirestore(serviceId);
    
    console.log(`${serviceId} removed successfully`);
    return { success: true, serviceId };
  } catch (error) {
    console.error(`Error removing ${serviceId}:`, error);
    return { success: false, error: error.message };
  }
}

// Remove service from Firestore
async function removeServiceFromFirestore(serviceId) {
  try {
    console.log(`🔍 Removing service ${serviceId} from Firestore...`);
    
    // Get current user
    const stored = await chrome.storage.local.get(['user']);
    if (!stored.user) {
      console.error('❌ No user available for Firestore service removal');
      return;
    }
    
    const { user } = stored;
    console.log(`🔍 Removing service for user: ${user.email}`);
    
    // Use email as document ID for consistency
    const userId = user.email;
    
    // Reference to user document
    const userDocRef = doc(db, 'users', userId);
    
    // Remove the specific platform by setting it to disabled state
    const platformUpdate = {
      enabled: false,
      lastScrapedAt: null,
      needsUpdatedCredentials: false,
      needsFullRediscover: false,
      cookies: []
    };
    
    // Update the specific platform in Firestore
    await updateDoc(userDocRef, {
      [`platforms.${serviceId}`]: platformUpdate,
      updatedAt: new Date().toISOString()
    });
    
    console.log(`✅ Service ${serviceId} removed successfully from Firestore`);
    
  } catch (error) {
    console.error('❌ Error removing service from Firestore:', error);
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
  }
}

console.log('Service worker ready');
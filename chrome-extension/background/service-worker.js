/******/ (() => { // webpackBootstrap
// Simplified service worker for cookie harvesting extension

// Service worker initialization

// Firebase configuration (public config - safe for client-side)
const firebaseConfig = {
  apiKey: "AIzaSyDGTTE53C9PPhvkNdPaayZTW_4bk-1kme8",
  authDomain: "marketing-website-429914.firebaseapp.com",
  projectId: "marketing-website-429914",
  storageBucket: "marketing-website-429914.firebasestorage.app",
  messagingSenderId: "778252380272",
  appId: "1:778252380272:web:38a726c435a716f0d8ecb5",
  measurementId: "G-17VZMDFX05"
};

// Database configuration
const DATABASE_ID = "instalily-internal-cosailor-db";

// Firebase Auth configured for secure access

// Supported platforms for cookie harvesting
const PLATFORMS = {
  fathom: {
    name: 'Fathom',
    url: 'https://fathom.video/users/sign_in',
    domain: 'fathom.video'
  },
  circleback: {
    name: 'Circleback', 
    url: 'https://app.circleback.ai/login',
    domain: 'app.circleback.ai'
  }
};

// Initialize extension with popup behavior for all browsers
const initializeExtension = async () => {
  console.log('🔧 Initializing extension in popup mode for all browsers...');
  console.log('🔧 User agent:', navigator.userAgent);
  
  try {
    // Ensure popup is set for all browsers
    await chrome.action.setPopup({ popup: 'popup/popup.html' });
    console.log('✅ Popup mode enabled for all browsers');
  } catch (error) {
    console.error('❌ Failed to set popup:', error);
  }
};

// Initialize on startup
initializeExtension();

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received:', request.action);

  if (request.action === 'checkAuthStatus') {
    checkAuthStatus().then(sendResponse);
    return true;
  } else if (request.action === 'googleAuth') {
    handleGoogleAuth().then(sendResponse);
    return true;
  } else if (request.action === 'googleSignOut') {
    handleGoogleSignOut().then(sendResponse);
    return true;
  } else if (request.action === 'harvestCookies') {
    handleHarvestCookies(request.platform).then(sendResponse);
    return true;
  } else if (request.action === 'removePlatform') {
    handleRemovePlatform(request.platform).then(sendResponse);
    return true;
  }
});

// Check authentication status and sync data from Firestore
async function checkAuthStatus() {
  try {
    const stored = await chrome.storage.local.get(['user', 'accessToken']);
    
    if (stored.user && stored.accessToken) {
      // Try to sync user data and platforms from Firestore
      try {
        const firestoreData = await fetchUserDataFromFirestore(stored.user.email, stored.accessToken);
        if (firestoreData) {
          // Update local storage with Firestore data
          await chrome.storage.local.set({
            user: firestoreData.user,
            platforms: firestoreData.platforms
          });
          
          return {
            isAuthenticated: true,
            user: firestoreData.user,
            platforms: firestoreData.platforms
          };
        }
      } catch (error) {
        console.warn('Failed to sync from Firestore, using local data:', error);
      }
      
      // Fallback to local data if Firestore sync fails
      const localPlatforms = await chrome.storage.local.get(['platforms']);
      return {
        isAuthenticated: true,
        user: stored.user,
        platforms: localPlatforms.platforms || {}
      };
    }
    
    return { isAuthenticated: false };
  } catch (error) {
    console.error('Error checking auth status:', error);
    return { isAuthenticated: false, error: error.message };
  }
}

// Handle Google authentication
async function handleGoogleAuth() {
  try {
    console.log('🔍 Starting Google authentication...');
    
    // Clear any existing auth state to force account picker
    await chrome.identity.clearAllCachedAuthTokens();
    
    // Log extension ID and redirect URI for debugging
    console.log('🔧 Extension ID:', chrome.runtime.id);
    console.log('🔧 Expected redirect URI:', `chrome-extension://${chrome.runtime.id}/`);
    console.log('🔧 User agent:', navigator.userAgent);
    
    // Get OAuth token with forced interaction
    const accessToken = await new Promise((resolve, reject) => {
      // Try OAuth with retry mechanism for different browsers
      const attemptOAuth = (attempt = 1) => {
        console.log(`🔧 OAuth attempt ${attempt}`);
        
        console.log('🔧 Attempting OAuth with scopes:', [
          'openid', 
          'email', 
          'profile',
          'https://www.googleapis.com/auth/datastore'
        ]);
        
        chrome.identity.getAuthToken({ 
          interactive: true,
          scopes: [
            'openid', 
            'email', 
            'profile',
            'https://www.googleapis.com/auth/datastore'
          ]
        }, (token) => {
          if (chrome.runtime.lastError) {
            console.error('🔧 OAuth Error Details:', chrome.runtime.lastError);
            console.error('🔧 Full error object:', JSON.stringify(chrome.runtime.lastError, null, 2));
            console.error('🔧 Extension ID used for OAuth:', chrome.runtime.id);
            console.error('🔧 Browser info:', {
              userAgent: navigator.userAgent,
              vendor: navigator.vendor,
              platform: navigator.platform
            });
            
            // For Arc browser, try a different approach if the first attempt fails
            if (attempt === 1 && chrome.runtime.lastError.message?.includes('invalid_request')) {
              console.log('🔄 First OAuth attempt failed, trying with reduced scopes...');
              
              // Try with basic scopes only
              chrome.identity.getAuthToken({ 
                interactive: true,
                scopes: [
                  'openid', 
                  'email', 
                  'profile'
                ]
              }, (fallbackToken) => {
                if (chrome.runtime.lastError) {
                  console.error('🔧 Fallback OAuth also failed:', chrome.runtime.lastError);
                  reject(chrome.runtime.lastError);
                } else {
                  console.log('✅ Fallback OAuth succeeded with basic scopes');
                  resolve(fallbackToken);
                }
              });
              return;
            }
            
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      };
      
      attemptOAuth();
    });
    
    console.log('✅ Got OAuth token');
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info');
    }
    
    const userInfo = await userInfoResponse.json();
    console.log('✅ Got user info:', userInfo.email);
    
    // Store user info locally
    const user = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    };
    
    await chrome.storage.local.set({
      user: user,
      accessToken: accessToken
    });
    
    // Store user info in Firestore using Firebase Auth
    try {
      await storeUserInFirestore(userInfo, accessToken);
      console.log('✅ User stored in Firestore');
    } catch (error) {
      console.error('Failed to store user in Firestore:', error);
    }
    
    return {
      success: true,
      user: user
    };
    
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return {
      success: false, 
      error: error.message || 'Authentication failed'
    };
  }
}

// Handle sign out
async function handleGoogleSignOut() {
  try {
    // Clear stored tokens
    const stored = await chrome.storage.local.get(['accessToken']);
    if (stored.accessToken) {
      await chrome.identity.removeCachedAuthToken({ token: stored.accessToken });
    }
    
    // Clear all cached auth tokens
    await chrome.identity.clearAllCachedAuthTokens();
    
    // Clear local storage
    await chrome.storage.local.clear();
    
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message };
  }
}

// Handle cookie harvesting for a platform
async function handleHarvestCookies(platformId) {
  try {
    console.log(`🍪 Harvesting cookies for ${platformId}...`);
    
    const platform = PLATFORMS[platformId];
    if (!platform) {
      throw new Error(`Unknown platform: ${platformId}`);
    }
    
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Open platform login page
    const tab = await chrome.tabs.create({ 
      url: platform.url,
      active: true 
    });
    
    console.log(`✅ Opened ${platform.name} login page`);
    
    // Set up a listener to detect when cookies are available
    return new Promise((resolve) => {
      let hasNavigatedToApp = false;
      
      // Enhanced check for cookies and navigation state
      const checkCookies = async () => {
        try {
          // Check current tab URL to see if user has navigated to main app
          let currentUrl = '';
          try {
            const currentTab = await chrome.tabs.get(tab.id);
            currentUrl = currentTab.url || '';
          } catch (e) {
            // Tab might be closed
            resolve({
              success: false,
              platform: platformId,
              error: 'Login tab was closed before authentication completed.'
            });
            return;
          }
          
          // For Circleback, check if user has navigated from /login to main app
          if (platformId === 'circleback') {
            if (currentUrl.includes('app.circleback.ai') && !currentUrl.includes('/login')) {
              hasNavigatedToApp = true;
              console.log(`✅ ${platform.name} user has navigated to main app`);
            }
          } else {
            // For other platforms, assume navigation is complete if not on login page
            if (!currentUrl.includes('login') && !currentUrl.includes('sign_in')) {
              hasNavigatedToApp = true;
            }
          }
          
          const cookies = await chrome.cookies.getAll({
            domain: platform.domain
          });
          
          // Filter for authentication-related cookies
          const authCookies = cookies.filter(cookie => {
            const name = cookie.name.toLowerCase();
            return name.includes('session') || 
                   name.includes('auth') || 
                   name.includes('token') || 
                   name.includes('login') ||
                   name.includes('jwt') ||
                   name.includes('access') ||
                   name === '_session_id' ||
                   name === 'sessionid' ||
                   name.startsWith('_');
          });
          
          // For Circleback, require both cookies AND navigation to main app
          const shouldComplete = platformId === 'circleback' 
            ? (authCookies.length > 0 && hasNavigatedToApp)
            : authCookies.length > 0;
          
          if (shouldComplete) {
            console.log(`✅ Found ${authCookies.length} auth cookies for ${platform.name}${hasNavigatedToApp ? ' and user navigated to main app' : ''}`);
            
            // Wait for page to complete loading before finalizing
            const waitForPageLoad = async () => {
              try {
                const currentTab = await chrome.tabs.get(tab.id);
                
                if (currentTab.status === 'complete') {
                  console.log(`✅ Page fully loaded for ${platform.name}, harvesting cookies...`);
                  
                  // Re-fetch cookies after page is fully loaded to ensure we have all cookies
                  const finalCookies = await chrome.cookies.getAll({
                    domain: platform.domain
                  });
                  
                  const finalAuthCookies = finalCookies.filter(cookie => {
                    const name = cookie.name.toLowerCase();
                    return name.includes('session') || 
                           name.includes('auth') || 
                           name.includes('token') || 
                           name.includes('login') ||
                           name.includes('jwt') ||
                           name.includes('access') ||
                           name === '_session_id' ||
                           name === 'sessionid' ||
                           name.startsWith('_');
                  });
                  
                  // Store cookies in Firestore using Firebase Auth
                  try {
                    await storeCookiesInFirestore(user.email, platformId, finalAuthCookies);
                    console.log(`✅ Cookies stored in Firestore for ${platform.name}`);
                  } catch (storeError) {
                    console.error(`❌ Failed to store cookies for ${platform.name}:`, storeError);
                    // Fallback to local storage
                    await storeCookiesLocally(user.email, platformId, finalAuthCookies);
                    console.log(`✅ Cookies stored locally as fallback for ${platform.name}`);
                  }
                  
                  // Update local storage to reflect platform is connected
                  const stored = await chrome.storage.local.get(['platforms']);
                  const platforms = stored.platforms || {};
                  platforms[platformId] = {
                    connected: true,
                    connecting: false,
                    lastHarvest: Date.now(),
                    cookiesCount: finalAuthCookies.length
                  };
                  await chrome.storage.local.set({ platforms });
                  console.log(`✅ Updated local storage for ${platform.name}`);
                  
                  // Wait a moment before closing to ensure all operations complete
                  setTimeout(async () => {
                    try {
                      await chrome.tabs.remove(tab.id);
                      console.log(`✅ Closed tab after successful login for ${platform.name}`);
                    } catch (e) {
                      // Tab might already be closed
                    }
                  }, 1000);
                  
                  resolve({
                    success: true,
                    platform: platformId,
                    cookiesCount: finalAuthCookies.length,
                    message: `Successfully harvested ${finalAuthCookies.length} cookies from ${platform.name}`
                  });
                } else {
                  // Page still loading, check again in a moment
                  setTimeout(waitForPageLoad, 500);
                }
              } catch (e) {
                // Tab might be closed, resolve with what we have
                resolve({
                  success: true,
                  platform: platformId,
                  cookiesCount: authCookies.length,
                  message: `Successfully harvested ${authCookies.length} cookies from ${platform.name}`
                });
              }
            };
            
            // Start waiting for page load
            waitForPageLoad();
            return;
          }
        } catch (error) {
          console.error(`Error checking cookies for ${platform.name}:`, error);
        }
        
        // Check again in 2 seconds
        setTimeout(checkCookies, 2000);
      };
      
      // Start checking after 3 seconds to give user time to log in
      setTimeout(checkCookies, 3000);
      
      // Timeout after 2 minutes
      setTimeout(() => {
        const timeoutMessage = platformId === 'circleback' 
          ? 'Timeout waiting for login. Please ensure you logged in successfully and were redirected to the main Circleback app.'
          : 'Timeout waiting for login cookies. Please ensure you logged in successfully.';
        
        resolve({
          success: false,
          platform: platformId,
          error: timeoutMessage
        });
      }, 120000);
    });
    
  } catch (error) {
    console.error(`❌ Cookie harvesting error for ${platformId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Handle platform removal
async function handleRemovePlatform(platformId) {
  try {
    console.log(`🗑️ Removing platform ${platformId}...`);
    
    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Remove from Firestore
    try {
      await removePlatformFromFirestore(user.email, platformId);
      console.log(`✅ Platform ${platformId} removed from Firestore`);
    } catch (firestoreError) {
      console.error(`❌ Failed to remove ${platformId} from Firestore:`, firestoreError);
      // Continue with local removal even if Firestore fails
    }
    
    return {
      success: true,
      platform: platformId,
      message: `Successfully removed ${platformId}`
    };
  } catch (error) {
    console.error(`❌ Platform removal failed for ${platformId}:`, error);
    return { success: false, error: error.message };
  }
}

// Get current authenticated user
async function getCurrentUser() {
  try {
    const stored = await chrome.storage.local.get(['user']);
    return stored.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

// Store user info in Firestore using Firebase Auth
async function storeUserInFirestore(userInfo, accessToken) {
  try {
    const username = userInfo.email.split('@')[0];
    
    // First, get existing document to avoid overwriting other data
    const getUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents/users/${username}`;
    
    let existingDoc = null;
    try {
      const getResponse = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (getResponse.ok) {
        existingDoc = await getResponse.json();
      }
    } catch (error) {
      console.log('Document does not exist yet, will create new one');
    }
    
    // Prepare meeting_notes_extension data
    const meetingNotesExtension = {
      mapValue: {
        fields: {
          email: { stringValue: userInfo.email },
          name: { stringValue: userInfo.name || '' },
          picture: { stringValue: userInfo.picture || '' },
          lastLogin: { timestampValue: new Date().toISOString() },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      }
    };
    
    // Prepare the document update
    const updateFields = {
      meeting_notes_extension: meetingNotesExtension
    };
    
    // If document exists, preserve existing fields and add/update only our fields
    let document;
    if (existingDoc && existingDoc.fields) {
      // Preserve existing fields, update only our extension data
      document = {
        fields: {
          ...existingDoc.fields,
          ...updateFields
        }
      };
    } else {
      // New document
      document = {
        fields: updateFields
      };
    }
    
    // Store/update user info using Firebase Auth token
    const updateUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents/users/${username}`;
    
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(document)
    });
    
    if (!response.ok) {
      throw new Error(`Firestore API error: ${response.status} ${response.statusText}`);
    }
    
    console.log(`✅ User stored in Firestore: /users/${username} (meeting_notes_extension)`);
  } catch (error) {
    console.error(`❌ Failed to store user in Firestore:`, error);
    throw error;
  }
}

// Store harvested cookies in Firestore using Firebase Auth
async function storeCookiesInFirestore(userEmail, platformId, cookies) {
  try {
    const username = userEmail.split('@')[0];
    
    // Get user's access token for authentication
    const stored = await chrome.storage.local.get(['accessToken']);
    if (!stored.accessToken) {
      throw new Error('No access token available');
    }
    
    // First, get existing document to avoid overwriting other data
    const getUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents/users/${username}`;
    
    let existingDoc = null;
    try {
      const getResponse = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${stored.accessToken}`
        }
      });
      if (getResponse.ok) {
        existingDoc = await getResponse.json();
      }
    } catch (error) {
      console.log('Document does not exist yet, will create with platform data');
    }
    
    // Prepare cookie data with all fields
    const cookieData = cookies.map(cookie => ({
      mapValue: {
        fields: {
          name: { stringValue: cookie.name || '' },
          value: { stringValue: cookie.value || '' },
          domain: { stringValue: cookie.domain || '' },
          path: { stringValue: cookie.path || '/' },
          secure: { booleanValue: cookie.secure || false },
          httpOnly: { booleanValue: cookie.httpOnly || false },
          sameSite: { stringValue: cookie.sameSite || 'unspecified' },
          expirationDate: { 
            doubleValue: cookie.expirationDate || 0
          },
          hostOnly: { booleanValue: cookie.hostOnly || false },
          session: { booleanValue: cookie.session || false },
          storeId: { stringValue: cookie.storeId || '0' }
        }
      }
    }));
    
    // Prepare platform data
    const platformData = {
      mapValue: {
        fields: {
          cookies: {
            arrayValue: {
              values: cookieData
            }
          },
          lastHarvest: { timestampValue: new Date().toISOString() },
          cookiesCount: { integerValue: cookies.length },
          timestamp: { integerValue: Date.now() }
        }
      }
    };
    
    // Prepare platforms dict - get existing platforms or create new
    let platformsDict = {
      mapValue: {
        fields: {
          [platformId]: platformData
        }
      }
    };
    
    // If document exists and has platforms, merge with existing platforms
    if (existingDoc?.fields?.platforms?.mapValue?.fields) {
      platformsDict.mapValue.fields = {
        ...existingDoc.fields.platforms.mapValue.fields,
        [platformId]: platformData
      };
    }
    
    // Prepare the document update
    const updateFields = {
      platforms: platformsDict
    };
    
    // If document exists, preserve existing fields and add/update only platforms
    let document;
    if (existingDoc && existingDoc.fields) {
      // Preserve existing fields, update only platforms
      document = {
        fields: {
          ...existingDoc.fields,
          ...updateFields
        }
      };
    } else {
      // New document with just platforms
      document = {
        fields: updateFields
      };
    }
    
    // Store cookies in user document as nested dict
    const updateUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents/users/${username}`;
    
    const response = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${stored.accessToken}`
      },
      body: JSON.stringify(document)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Firestore API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    console.log(`✅ Cookies stored in Firestore: /users/${username}.platforms.${platformId}`);
  } catch (error) {
    console.error(`❌ Failed to store cookies in Firestore:`, error);
    throw error;
  }
}

// Remove platform data from Firestore
async function removePlatformFromFirestore(userEmail, platformId) {
  try {
    const username = userEmail.split('@')[0];
    
    // Get user's access token for authentication
    const stored = await chrome.storage.local.get(['accessToken']);
    if (!stored.accessToken) {
      throw new Error('No access token available');
    }
    
    // First, get existing document to preserve other data
    const getUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents/users/${username}`;
    
    const getResponse = await fetch(getUrl, {
      headers: {
        'Authorization': `Bearer ${stored.accessToken}`
      }
    });
    
    if (!getResponse.ok) {
      if (getResponse.status === 404) {
        console.log('User document not found in Firestore');
        return;
      }
      throw new Error(`Firestore API error: ${getResponse.status} ${getResponse.statusText}`);
    }
    
    const existingDoc = await getResponse.json();
    
    // Remove the platform from platforms dict
    if (existingDoc?.fields?.platforms?.mapValue?.fields) {
      const platformsDict = { ...existingDoc.fields.platforms.mapValue.fields };
      delete platformsDict[platformId];
      
      // Update the document with the platform removed
      const updateFields = {
        platforms: {
          mapValue: {
            fields: platformsDict
          }
        }
      };
      
      // Preserve existing fields, update only platforms
      const document = {
        fields: {
          ...existingDoc.fields,
          ...updateFields
        }
      };
      
      const updateUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents/users/${username}`;
      
      const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${stored.accessToken}`
        },
        body: JSON.stringify(document)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Firestore API error: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      console.log(`✅ Platform ${platformId} removed from Firestore: /users/${username}.platforms`);
    } else {
      console.log(`Platform ${platformId} not found in Firestore document`);
    }
  } catch (error) {
    console.error(`❌ Failed to remove platform ${platformId} from Firestore:`, error);
    throw error;
  }
}

// Store harvested cookies locally (fallback)
async function storeCookiesLocally(userId, platformId, cookies) {
  try {
    // Get existing stored cookies
    const stored = await chrome.storage.local.get(['harvestedCookies']);
    const harvestedCookies = stored.harvestedCookies || [];
    
    // Add new cookie harvest
    const cookieHarvest = {
      id: Date.now().toString(),
      userId: userId,
      platform: platformId,
      cookies: cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        expirationDate: cookie.expirationDate
      })),
      harvestedAt: new Date().toISOString(),
      timestamp: Date.now()
    };
    
    harvestedCookies.push(cookieHarvest);
    
    // Keep only last 50 harvests to avoid storage bloat
    if (harvestedCookies.length > 50) {
      harvestedCookies.splice(0, harvestedCookies.length - 50);
    }
    
    // Store back to local storage
    await chrome.storage.local.set({ harvestedCookies });
    
    console.log(`✅ Cookies stored locally for ${platformId} (${cookies.length} cookies)`);
  } catch (error) {
    console.error(`❌ Failed to store cookies locally for ${platformId}:`, error);
    throw error;
  }
}

// Fetch user data from Firestore including platforms
async function fetchUserDataFromFirestore(userEmail, accessToken) {
  try {
    const username = userEmail.split('@')[0];
    const getUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${DATABASE_ID}/documents/users/${username}`;
    
    const response = await fetch(getUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('User document not found in Firestore');
        return null;
      }
      throw new Error(`Firestore API error: ${response.status} ${response.statusText}`);
    }
    
    const doc = await response.json();
    
    // Extract user data from meeting_notes_extension
    let userData = {};
    if (doc.fields?.meeting_notes_extension?.mapValue?.fields) {
      const extensionData = doc.fields.meeting_notes_extension.mapValue.fields;
      userData = {
        email: extensionData.email?.stringValue || userEmail,
        name: extensionData.name?.stringValue || '',
        picture: extensionData.picture?.stringValue || '',
        id: extensionData.id?.stringValue || userEmail.split('@')[0]
      };
    }
    
    // Extract platforms data and convert to UI format
    let platformsData = {};
    if (doc.fields?.platforms?.mapValue?.fields) {
      const firestorePlatforms = doc.fields.platforms.mapValue.fields;
      
      for (const [platformId, platformData] of Object.entries(firestorePlatforms)) {
        if (platformData.mapValue?.fields) {
          const fields = platformData.mapValue.fields;
          platformsData[platformId] = {
            connected: true,
            connecting: false,
            lastHarvest: fields.timestamp?.integerValue ? parseInt(fields.timestamp.integerValue) : Date.now(),
            cookiesCount: fields.cookiesCount?.integerValue ? parseInt(fields.cookiesCount.integerValue) : 0,
            needsCookieUpdate: fields.needs_cookie_update?.booleanValue || false
          };
        }
      }
    }
    
    console.log(`✅ Fetched user data from Firestore: ${username}`);
    console.log('Platforms data from Firestore:', platformsData);
    return {
      user: userData,
      platforms: platformsData
    };
    
  } catch (error) {
    console.error('Failed to fetch user data from Firestore:', error);
    throw error;
  }
}

console.log('✅ Service worker loaded');
/******/ })()
;
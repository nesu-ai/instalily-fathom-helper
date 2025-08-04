// Firebase imports for direct Firestore access (no Auth)
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

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

// Use Firebase REST API for authentication instead of Firebase Auth SDK
async function signInWithGoogleToken(accessToken) {
  try {
    // Exchange Google access token for Firebase ID token using REST API
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        postBody: `access_token=${accessToken}&providerId=google.com`,
        requestUri: 'https://localhost',
        returnIdpCredential: true,
        returnSecureToken: true
      })
    });

    if (!response.ok) {
      throw new Error('Failed to sign in with Google token');
    }

    const data = await response.json();
    return {
      uid: data.localId,
      email: data.email,
      displayName: data.displayName,
      photoUrl: data.photoUrl,
      idToken: data.idToken,
      refreshToken: data.refreshToken
    };
  } catch (error) {
    console.error('Error signing in with Google token:', error);
    throw error;
  }
}

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
  }
  
  // Initialize default settings
  chrome.storage.local.set({
    autoSync: false,
    targetDriveId: null,
    targetFolderId: null,
    platforms: {},
    user: null
  });
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Console log to debug incoming messages
  console.log('📨 Message received:', request.action, request);
  
  // Handle different actions
  if (request.action === 'platformLogin') {
    handlePlatformLogin(request.platform).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'checkAuthStatus') {
    checkAuthStatus().then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'googleAuth') {
    handleGoogleAuth().then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'googleSignOut') {
    handleGoogleSignOut().then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'processNote') {
    handleProcessNote(request.data).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'updateSettings') {
    handleUpdateSettings(request.settings).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'getSettings') {
    handleGetSettings().then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'checkNeedUpdate') {
    handleCheckNeedUpdate(request).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'updateProcessedStatus') {
    handleUpdateProcessedStatus(request).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'setDriveFolder') {
    handleSetDriveFolder(request).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'getDriveFiles') {
    handleGetDriveFiles().then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'searchDriveFolders') {
    handleSearchDriveFolders(request.query).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'toggleAutoSync') {
    handleToggleAutoSync(request.enabled).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'processedFromGDrive') {
    handleProcessedFromGDrive(request).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'getProcessingHistory') {
    handleGetProcessingHistory().then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'getMeetingById') {
    handleGetMeetingById(request.meetingId).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'updateMeeting') {
    handleUpdateMeeting(request.meetingId, request.updates).then(sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'manualSync') {
    handleManualSync().then(sendResponse);
    return true; // Will respond asynchronously
  }
});

// Helper function to make authenticated Firestore requests
async function makeAuthenticatedFirestoreRequest(method, path, data = null) {
  const stored = await chrome.storage.local.get(['firebaseAuth']);
  if (!stored.firebaseAuth || !stored.firebaseAuth.idToken) {
    throw new Error('Not authenticated');
  }

  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents${path}`;
  
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${stored.firebaseAuth.idToken}`,
      'Content-Type': 'application/json',
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);
  
  if (response.status === 401) {
    // Token expired, try to refresh
    // For now, just throw error
    throw new Error('Authentication expired');
  }

  if (!response.ok) {
    throw new Error(`Firestore request failed: ${response.statusText}`);
  }

  return response.json();
}

async function handleManualSync() {
  try {
    console.log('Starting manual sync...');
    
    // Trigger sync across all platforms
    const platforms = ['fathom', 'circleback', 'fireflies', 'zoom'];
    const results = [];
    
    for (const platform of platforms) {
      try {
        // Send message to content script to collect data
        const tabs = await chrome.tabs.query({ url: [`https://*.${getPlatformDomain(platform)}/*`] });
        
        if (tabs.length > 0) {
          const response = await chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'collectMeetings' 
          });
          
          if (response && response.meetings) {
            results.push({
              platform,
              count: response.meetings.length,
              status: 'success'
            });
          }
        } else {
          results.push({
            platform,
            count: 0,
            status: 'no_tab'
          });
        }
      } catch (error) {
        results.push({
          platform,
          count: 0,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return { success: true, results };
  } catch (error) {
    console.error('Manual sync error:', error);
    return { success: false, error: error.message };
  }
}

function getPlatformDomain(platform) {
  const domains = {
    fathom: 'fathom.video',
    circleback: 'circleback.ai',
    fireflies: 'fireflies.ai',
    zoom: 'zoom.us'
  };
  return domains[platform] || '';
}

async function handleGetMeetingById(meetingId) {
  try {
    const doc = await getDoc(doc(db, 'meeting_insights', meetingId));
    
    if (doc.exists()) {
      return {
        success: true,
        meeting: { id: doc.id, ...doc.data() }
      };
    } else {
      return {
        success: false,
        error: 'Meeting not found'
      };
    }
  } catch (error) {
    console.error('Error getting meeting:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleUpdateMeeting(meetingId, updates) {
  try {
    await updateDoc(doc(db, 'meeting_insights', meetingId), {
      ...updates,
      lastUpdated: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating meeting:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function handleGetProcessingHistory() {
  try {
    const stored = await chrome.storage.local.get(['processingHistory']);
    return {
      success: true,
      history: stored.processingHistory || []
    };
  } catch (error) {
    console.error('Error getting processing history:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Google Authentication Handler
async function handleGoogleAuth() {
  try {
    console.log('🔐 Starting Google authentication...');
    
    // For development/testing - skip actual auth
    if (DEV_MODE) {
      console.log('⚠️ DEV MODE: Skipping actual authentication');
      const mockUser = {
        id: 'dev-user-123',
        email: 'dev@example.com',
        name: 'Dev User',
        picture: 'https://via.placeholder.com/96'
      };
      
      await chrome.storage.local.set({
        user: mockUser,
        accessToken: 'dev-token'
      });
      
      return {
        success: true,
        user: mockUser
      };
    }
    
    // Clear any existing auth state to force account picker
    await chrome.identity.clearAllCachedAuthTokens();
    
    console.log('🔍 Getting OAuth2 token with account picker...');
    
    // Try a different approach: use launchWebAuthFlow with the Chrome extension redirect URI pattern
    const CLIENT_ID = '778252380272-m677khkbppklvp7p8gifncneqafkhv3g.apps.googleusercontent.com';
    
    // Get the extension's redirect URI - this will be in the format https://<extension-id>.chromiumapp.org/
    const redirectUri = chrome.identity.getRedirectURL();
    console.log('🔍 Extension redirect URI:', redirectUri);
    
    // Build the auth URL with prompt=select_account to force account picker
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(CLIENT_ID)}&` +
      `response_type=token&` + // Use implicit flow for extensions
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent('openid email profile https://www.googleapis.com/auth/drive.file')}&` +
      `prompt=select_account`;
    
    console.log('🔍 Auth URL:', authUrl);
    
    let accessToken;
    
    try {
      // Launch web auth flow with account selection
      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow({
          url: authUrl,
          interactive: true
        }, (responseUrl) => {
          if (chrome.runtime.lastError) {
            console.error('🔍 Auth flow error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            console.log('🔍 Auth flow response:', responseUrl);
            resolve(responseUrl);
          }
        });
      });
      
      // Extract access token from response URL (implicit flow)
      const hashParams = new URLSearchParams(responseUrl.split('#')[1]);
      accessToken = hashParams.get('access_token');
      
      if (!accessToken) {
        throw new Error('No access token received from OAuth flow');
      }
      
      console.log('✅ Got access token from web auth flow');
      
    } catch (webAuthError) {
      console.warn('🔍 Web auth flow failed, falling back to getAuthToken:', webAuthError.message);
      
      // Fallback to getAuthToken if web auth flow fails
      accessToken = await new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ 
          interactive: true,
          scopes: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/drive.file'
          ]
        }, (token) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(token);
          }
        });
      });
      
      console.log('✅ Got OAuth token from fallback method');
    }
    
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
    
    // Sign in to Firebase with the Google token
    const firebaseAuth = await signInWithGoogleToken(accessToken);
    console.log('✅ Firebase Auth successful:', firebaseAuth.uid);
    
    // Store user info and Firebase auth
    const user = {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      firebaseUid: firebaseAuth.uid
    };
    
    await chrome.storage.local.set({
      user: user,
      accessToken: accessToken,
      firebaseAuth: firebaseAuth
    });
    
    // Store user info in Firestore
    try {
      await makeAuthenticatedFirestoreRequest('PATCH', `/users/${firebaseAuth.uid}`, {
        fields: {
          email: { stringValue: userInfo.email },
          name: { stringValue: userInfo.name || '' },
          picture: { stringValue: userInfo.picture || '' },
          lastLogin: { timestampValue: new Date().toISOString() },
          extensionVersion: { stringValue: chrome.runtime.getManifest().version }
        }
      });
      console.log('✅ User info stored in Firestore');
    } catch (error) {
      console.error('Failed to store user info in Firestore:', error);
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

// Handle check if meeting needs update
async function handleCheckNeedUpdate(request) {
  try {
    const { meetingId, currentVersion } = request;
    
    if (!meetingId) {
      return { needsUpdate: false };
    }
    
    const docRef = doc(db, 'meeting_insights', meetingId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      // Document doesn't exist, needs creation
      return { needsUpdate: true };
    }
    
    const data = docSnap.data();
    const storedVersion = data.insightsVersion || '1.0';
    
    // Compare versions - if current is newer, needs update
    return { 
      needsUpdate: currentVersion !== storedVersion,
      storedVersion: storedVersion
    };
  } catch (error) {
    console.error('Error checking update status:', error);
    return { needsUpdate: false, error: error.message };
  }
}

// Handle updating processed status
async function handleUpdateProcessedStatus(request) {
  try {
    const { meetingId, platform, status } = request;
    
    const user = await getCurrentUser();
    if (!user || !user.firebaseUid) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const docRef = doc(db, 'meeting_insights', meetingId);
    
    await updateDoc(docRef, {
      [`${platform}_processed`]: status,
      [`${platform}_processedAt`]: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating processed status:', error);
    return { success: false, error: error.message };
  }
}

// Handle toggle auto sync
async function handleToggleAutoSync(enabled) {
  try {
    await chrome.storage.local.set({ autoSync: enabled });
    
    if (enabled) {
      // Set up periodic sync (every 30 minutes)
      chrome.alarms.create('autoSync', { periodInMinutes: 30 });
    } else {
      // Clear the alarm
      chrome.alarms.clear('autoSync');
    }
    
    return { success: true, autoSync: enabled };
  } catch (error) {
    console.error('Error toggling auto sync:', error);
    return { success: false, error: error.message };
  }
}

// Handle alarm for auto sync
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'autoSync') {
    handleManualSync();
  }
});

// Handle processed from GDrive
async function handleProcessedFromGDrive(request) {
  try {
    const { fileId, fileName, meetingId } = request;
    
    // Update processing history
    const stored = await chrome.storage.local.get(['processingHistory']);
    const history = stored.processingHistory || [];
    
    history.unshift({
      fileId,
      fileName,
      meetingId,
      processedAt: new Date().toISOString(),
      source: 'gdrive'
    });
    
    // Keep only last 100 entries
    if (history.length > 100) {
      history.length = 100;
    }
    
    await chrome.storage.local.set({ processingHistory: history });
    
    return { success: true };
  } catch (error) {
    console.error('Error recording GDrive processing:', error);
    return { success: false, error: error.message };
  }
}

// Handle search Drive folders
async function handleSearchDriveFolders(query) {
  try {
    const stored = await chrome.storage.local.get(['accessToken']);
    if (!stored.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    // Search for folders in Google Drive
    const searchParams = new URLSearchParams({
      q: `mimeType='application/vnd.google-apps.folder' and name contains '${query}' and trashed=false`,
      fields: 'files(id,name,parents)',
      orderBy: 'modifiedTime desc',
      pageSize: 20
    });
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${stored.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to search folders');
    }
    
    const data = await response.json();
    return {
      success: true,
      folders: data.files || []
    };
  } catch (error) {
    console.error('Error searching folders:', error);
    return { success: false, error: error.message };
  }
}

// Set Drive folder
async function handleSetDriveFolder(request) {
  try {
    const { folderId, folderName } = request;
    
    await chrome.storage.local.set({
      targetFolderId: folderId,
      targetFolderName: folderName
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error setting drive folder:', error);
    return { success: false, error: error.message };
  }
}

// Get Drive files
async function handleGetDriveFiles() {
  try {
    const stored = await chrome.storage.local.get(['accessToken', 'targetFolderId']);
    if (!stored.accessToken) {
      return { success: false, error: 'Not authenticated' };
    }
    
    if (!stored.targetFolderId) {
      return { success: false, error: 'No folder selected' };
    }
    
    // Get files from the selected folder
    const searchParams = new URLSearchParams({
      q: `'${stored.targetFolderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,modifiedTime,size)',
      orderBy: 'modifiedTime desc',
      pageSize: 100
    });
    
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${searchParams}`, {
      headers: {
        'Authorization': `Bearer ${stored.accessToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to get files');
    }
    
    const data = await response.json();
    return {
      success: true,
      files: data.files || []
    };
  } catch (error) {
    console.error('Error getting files:', error);
    return { success: false, error: error.message };
  }
}

// Get current user from storage
async function getCurrentUser() {
  const stored = await chrome.storage.local.get(['user']);
  return stored.user || null;
}

// Handle note processing
async function handleProcessNote(noteData) {
  try {
    console.log('Processing note:', noteData);
    
    const user = await getCurrentUser();
    if (!user || !user.firebaseUid) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const { platform, meetingId, title, content, metadata } = noteData;
    
    // Create or update the meeting insight document
    const docRef = doc(db, 'meeting_insights', meetingId);
    
    const meetingData = {
      userId: user.firebaseUid,
      userEmail: user.email,
      platform: platform,
      meetingId: meetingId,
      title: title || 'Untitled Meeting',
      content: content,
      metadata: metadata || {},
      processedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      insightsVersion: '1.0'
    };
    
    // Store using REST API
    await makeAuthenticatedFirestoreRequest('PATCH', `/meeting_insights/${meetingId}`, {
      fields: {
        userId: { stringValue: meetingData.userId },
        userEmail: { stringValue: meetingData.userEmail },
        platform: { stringValue: meetingData.platform },
        meetingId: { stringValue: meetingData.meetingId },
        title: { stringValue: meetingData.title },
        content: { stringValue: meetingData.content },
        processedAt: { timestampValue: meetingData.processedAt },
        lastUpdated: { timestampValue: meetingData.lastUpdated },
        insightsVersion: { stringValue: meetingData.insightsVersion },
        metadata: { 
          mapValue: { 
            fields: Object.entries(metadata || {}).reduce((acc, [key, value]) => {
              acc[key] = { stringValue: String(value) };
              return acc;
            }, {})
          } 
        }
      }
    });
    
    // If Google Drive sync is enabled, also save to Drive
    const settings = await chrome.storage.local.get(['targetFolderId', 'accessToken']);
    if (settings.targetFolderId && settings.accessToken) {
      await saveToDrive(meetingData, settings.targetFolderId, settings.accessToken);
    }
    
    return { success: true, meetingId: meetingId };
  } catch (error) {
    console.error('Error processing note:', error);
    return { success: false, error: error.message };
  }
}

// Save to Google Drive
async function saveToDrive(meetingData, folderId, accessToken) {
  try {
    const fileName = `${meetingData.platform}_${meetingData.title.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.md`;
    
    const content = `# ${meetingData.title}

**Platform:** ${meetingData.platform}
**Date:** ${new Date(meetingData.processedAt).toLocaleString()}
**Meeting ID:** ${meetingData.meetingId}

## Content

${meetingData.content}

## Metadata
${JSON.stringify(meetingData.metadata, null, 2)}
`;
    
    // Create file metadata
    const metadata = {
      name: fileName,
      parents: [folderId],
      mimeType: 'text/markdown'
    };
    
    // Create the file
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('media', new Blob([content], { type: 'text/markdown' }));
    
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: form
    });
    
    if (!response.ok) {
      throw new Error('Failed to save to Drive');
    }
    
    console.log('Successfully saved to Google Drive');
  } catch (error) {
    console.error('Error saving to Drive:', error);
    // Don't throw - we don't want Drive errors to break the main flow
  }
}

// Settings handlers
async function handleGetSettings() {
  try {
    const settings = await chrome.storage.local.get([
      'autoSync',
      'targetFolderId',
      'targetFolderName',
      'platforms'
    ]);
    
    return {
      success: true,
      settings: {
        autoSync: settings.autoSync || false,
        targetFolderId: settings.targetFolderId || null,
        targetFolderName: settings.targetFolderName || null,
        platforms: settings.platforms || {}
      }
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return { success: false, error: error.message };
  }
}

async function handleUpdateSettings(newSettings) {
  try {
    await chrome.storage.local.set(newSettings);
    return { success: true };
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, error: error.message };
  }
}

// Handle Google sign out
async function handleGoogleSignOut() {
  try {
    // Clear stored tokens
    const stored = await chrome.storage.local.get(['accessToken']);
    if (stored.accessToken) {
      // Revoke the token
      await chrome.identity.removeCachedAuthToken({ token: stored.accessToken });
    }
    
    // Clear ALL cached auth tokens to force account picker on next login
    await chrome.identity.clearAllCachedAuthTokens();
    
    // Clear all stored data
    await chrome.storage.local.remove([
      'user', 
      'accessToken', 
      'firebaseAuth',
      'targetFolderId',
      'targetFolderName',
      'platforms'
    ]);
    
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message };
  }
}

// Check auth status
async function checkAuthStatus() {
  try {
    const stored = await chrome.storage.local.get(['user', 'platforms', 'firebaseAuth']);
    
    if (stored.user && stored.firebaseAuth) {
      // Check if token is still valid
      // For now, just return the stored user
      return {
        isAuthenticated: true,
        user: stored.user,
        platforms: stored.platforms || {}
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
          console.warn(`Failed to get cookies for domain ${domain}:`, err);
          return [];
        })
      );
      
      const cookieArrays = await Promise.all(allCookiePromises);
      cookies = cookieArrays.flat();
      
      console.log(`Found ${cookies.length} cookies for ${platform}`);
      
      // Look for session cookies
      const sessionCookies = cookies.filter(c => 
        c.name.toLowerCase().includes('session') || 
        c.name.toLowerCase().includes('auth') ||
        c.name.toLowerCase().includes('token') ||
        c.httpOnly // HttpOnly cookies are typically auth cookies
      );
      
      if (sessionCookies.length > 0 || cookies.length > 5) { // Having multiple cookies suggests logged in
        platforms[platform] = {
          isLoggedIn: true,
          lastChecked: new Date().toISOString(),
          cookieCount: cookies.length,
          domains: domains
        };
        console.log(`✅ ${platform} appears to be logged in`);
      } else {
        platforms[platform] = {
          isLoggedIn: false,
          lastChecked: new Date().toISOString(),
          cookieCount: cookies.length,
          domains: domains
        };
        console.log(`❌ ${platform} does not appear to be logged in`);
      }
    }
    
    // Save updated platforms
    await chrome.storage.local.set({ platforms });
    
    return { 
      success: true, 
      platform, 
      isLoggedIn: platforms[platform]?.isLoggedIn || false,
      details: platforms[platform]
    };
  } catch (error) {
    console.error(`Error checking ${platform} login:`, error);
    return { success: false, error: error.message };
  }
}

console.log('Service worker loaded successfully');
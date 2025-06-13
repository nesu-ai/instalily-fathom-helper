const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// TODO: Make this not homedir, later will be firestore actually
const COOKIE_DIR = path.join(os.homedir(), 'temp_fathom_cookies');
const COOKIE_FILE = path.join(COOKIE_DIR, 'session.json');


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
    // Ensure the cookie directory exists
    if (!fs.existsSync(COOKIE_DIR)) {
      fs.mkdirSync(COOKIE_DIR, { recursive: true });
    }

    createWindow();
  });

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
        fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
        console.log(`[✓] Saved ${cookies.length} cookies to ${COOKIE_FILE}`);
        
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
        fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2));
        console.log(`[✓] Saved ${cookies.length} cookies to ${COOKIE_FILE}`);
        
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

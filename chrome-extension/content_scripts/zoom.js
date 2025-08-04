// Content script for Zoom
console.log('Zoom content script loaded');

// Check if user is logged in
function checkLoginStatus() {
  // Check for common indicators of being logged in
  const loggedInIndicators = [
    document.querySelector('[data-testid="user-menu"]'),
    document.querySelector('.user-avatar'),
    document.querySelector('.zm-profile-menu'),
    document.querySelector('[href*="/profile"]'),
    document.querySelector('[href*="/dashboard"]'),
    document.querySelector('[href*="/meeting"]'),
    document.querySelector('[href*="/webinar"]'),
    document.querySelector('[href*="/recordings"]'),
    // Check if we're on authenticated pages
    window.location.pathname.includes('/dashboard'),
    window.location.pathname.includes('/meeting'),
    window.location.pathname.includes('/webinar'),
    window.location.pathname.includes('/recordings'),
    window.location.pathname.includes('/profile'),
    window.location.pathname.includes('/account'),
    // Check for common Zoom UI elements
    document.querySelector('.zm-nav'),
    document.querySelector('.zm-sidebar'),
    document.querySelector('.meeting-item'),
    document.querySelector('.recording-item'),
    document.querySelector('[data-testid*="meeting"]'),
    document.querySelector('[data-testid*="recording"]')
  ];
  
  const isLoggedIn = loggedInIndicators.some(indicator => !!indicator);
  
  if (isLoggedIn) {
    console.log('User is logged in to Zoom');
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'LOGIN_DETECTED',
      platform: 'zoom'
    }, response => {
      if (response?.success) {
        console.log('Zoom login processed successfully');
      }
    });
  }
}

// Check login status on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkLoginStatus);
} else {
  checkLoginStatus();
}

// Also check after navigation (for single-page apps)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(checkLoginStatus, 1000); // Wait for page to settle
  }
}).observe(document, { subtree: true, childList: true });

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_LOGIN_STATUS') {
    checkLoginStatus();
    sendResponse({ received: true });
  }
});

// Monitor for successful login redirects
if (window.location.pathname.includes('/signin') || 
    window.location.pathname.includes('/login') ||
    window.location.pathname.includes('/sso')) {
  // Watch for navigation away from login page
  const observer = new MutationObserver(() => {
    if (!window.location.pathname.includes('/signin') && 
        !window.location.pathname.includes('/login') &&
        !window.location.pathname.includes('/sso')) {
      observer.disconnect();
      setTimeout(checkLoginStatus, 2000); // Give time for cookies to set
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}
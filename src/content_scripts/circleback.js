// Content script for Circleback.ai
console.log('Circleback content script loaded');

// Check if user is logged in
function checkLoginStatus() {
  // Check for common indicators of being logged in
  const loggedInIndicators = [
    document.querySelector('[data-testid="user-menu"]'),
    document.querySelector('.user-profile'),
    document.querySelector('[href*="/settings"]'),
    document.querySelector('[href*="/dashboard"]'),
    document.querySelector('[href*="/meetings"]'),
    // Check if we're on authenticated pages
    window.location.pathname.includes('/dashboard'),
    window.location.pathname.includes('/meetings'),
    window.location.pathname.includes('/settings'),
    window.location.pathname.includes('/workspace')
  ];
  
  const isLoggedIn = loggedInIndicators.some(indicator => !!indicator);
  
  if (isLoggedIn) {
    console.log('User is logged in to Circleback');
    
    // Send message to background script
    chrome.runtime.sendMessage({
      type: 'LOGIN_DETECTED',
      platform: 'circleback'
    }, response => {
      if (response?.success) {
        console.log('Circleback login processed successfully');
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
if (window.location.pathname.includes('/login') || 
    window.location.pathname.includes('/signin') ||
    window.location.pathname.includes('/auth')) {
  // Watch for navigation away from login page
  const observer = new MutationObserver(() => {
    if (!window.location.pathname.includes('/login') && 
        !window.location.pathname.includes('/signin') &&
        !window.location.pathname.includes('/auth')) {
      observer.disconnect();
      setTimeout(checkLoginStatus, 2000); // Give time for cookies to set
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
}
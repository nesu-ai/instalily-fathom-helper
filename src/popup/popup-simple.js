// Simplified popup script for cookie harvesting extension
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  // Get elements
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  const loadingSection = document.getElementById('loading-section');
  const googleLoginBtn = document.getElementById('google-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  
  // Platform buttons
  const platformButtons = document.querySelectorAll('.platform-btn');
  
  // Supported platforms
  const PLATFORMS = {
    fathom: { name: 'Fathom', icon: '../icons/fathom.png' },
    circleback: { name: 'Circleback', icon: '../icons/circleback.png' },
    fireflies: { name: 'Fireflies', icon: '../icons/fireflies.png' },
    zoom: { name: 'Zoom', icon: '../icons/zoom.png' }
  };
  
  // Check authentication status on load
  checkAuthStatus();
  
  // Event listeners
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Platform button listeners
  platformButtons.forEach(button => {
    button.addEventListener('click', () => {
      const platform = button.dataset.platform;
      handlePlatformClick(platform);
    });
  });
  
  function checkAuthStatus() {
    console.log('Checking auth status...');
    showLoadingSection();
    
    chrome.runtime.sendMessage({ action: 'checkAuthStatus' }, (response) => {
      if (chrome.runtime?.lastError) {
        console.error('Runtime error:', chrome.runtime.lastError);
        showLoginSection();
        return;
      }
      
      if (response && response.isAuthenticated && response.user) {
        showUserSection(response.user);
      } else {
        showLoginSection();
      }
    });
  }
  
  function showLoginSection() {
    console.log('Showing login section');
    hideAllSections();
    if (loginSection) loginSection.classList.remove('hidden');
  }
  
  function showUserSection(user) {
    console.log('Showing user section for:', user);
    hideAllSections();
    if (userSection) userSection.classList.remove('hidden');
    
    // Update user info
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');
    
    if (userName) userName.textContent = user.name || 'Unknown User';
    if (userEmail) userEmail.textContent = user.email || 'No Email';
    if (userAvatar) userAvatar.src = user.picture || '../icons/icon-48.png';
    
    // Show platform buttons
    updatePlatformButtons();
  }
  
  function showLoadingSection() {
    hideAllSections();
    if (loadingSection) loadingSection.classList.remove('hidden');
  }
  
  function hideAllSections() {
    if (loadingSection) loadingSection.classList.add('hidden');
    if (loginSection) loginSection.classList.add('hidden');
    if (userSection) userSection.classList.add('hidden');
  }
  
  function updatePlatformButtons() {
    const platformsContainer = document.getElementById('platforms-container');
    if (!platformsContainer) return;
    
    platformsContainer.innerHTML = '';
    
    Object.entries(PLATFORMS).forEach(([id, platform]) => {
      const button = document.createElement('button');
      button.className = 'platform-btn';
      button.dataset.platform = id;
      button.innerHTML = `
        <img src="${platform.icon}" alt="${platform.name}" style="width: 24px; height: 24px; margin-right: 8px;">
        Harvest ${platform.name} Cookies
      `;
      
      button.addEventListener('click', () => handlePlatformClick(id));
      platformsContainer.appendChild(button);
    });
  }
  
  function handleGoogleLogin() {
    console.log('Login button clicked');
    showLoadingSection();
    
    chrome.runtime.sendMessage({ action: 'googleAuth' }, (response) => {
      console.log('Auth response:', response);
      
      if (response && response.success) {
        console.log('Login successful');
        checkAuthStatus();
      } else {
        console.error('Login failed:', response?.error);
        showLoginSection();
        showError(response?.error || 'Login failed. Please try again.');
      }
    });
  }
  
  function handleLogout() {
    logoutBtn.disabled = true;
    logoutBtn.textContent = 'Signing out...';
    
    chrome.runtime.sendMessage({ action: 'googleSignOut' }, (response) => {
      logoutBtn.disabled = false;
      logoutBtn.textContent = 'Sign Out';
      
      if (response && response.success) {
        checkAuthStatus();
      } else {
        console.error('Logout failed:', response?.error);
        showError(response?.error || 'Logout failed. Please try again.');
      }
    });
  }
  
  function handlePlatformClick(platformId) {
    console.log(`Platform clicked: ${platformId}`);
    
    const platform = PLATFORMS[platformId];
    if (!platform) {
      showError(`Unknown platform: ${platformId}`);
      return;
    }
    
    // Disable button during harvesting
    const button = document.querySelector(`[data-platform="${platformId}"]`);
    if (button) {
      button.disabled = true;
      button.textContent = `Opening ${platform.name}...`;
    }
    
    chrome.runtime.sendMessage({ 
      action: 'harvestCookies', 
      platform: platformId 
    }, (response) => {
      // Re-enable button
      if (button) {
        button.disabled = false;
        button.innerHTML = `
          <img src="${platform.icon}" alt="${platform.name}" style="width: 24px; height: 24px; margin-right: 8px;">
          Harvest ${platform.name} Cookies
        `;
      }
      
      if (response && response.success) {
        showSuccess(response.message || `${platform.name} login page opened`);
      } else {
        console.error(`Cookie harvesting failed for ${platformId}:`, response?.error);
        showError(response?.error || `Failed to harvest ${platform.name} cookies`);
      }
    });
  }
  
  function showError(message) {
    showMessage(message, 'error');
  }
  
  function showSuccess(message) {
    showMessage(message, 'success');
  }
  
  function showMessage(message, type = 'error') {
    // Remove existing messages
    const existingMessage = document.querySelector('.message-toast');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Create new message
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast message-${type}`;
    messageDiv.textContent = message;
    
    // Add to current visible section
    const activeSection = document.querySelector('.section:not(.hidden)');
    if (activeSection) {
      activeSection.appendChild(messageDiv);
    } else {
      document.querySelector('main').appendChild(messageDiv);
    }
    
    // Auto-remove after delay
    setTimeout(() => {
      if (messageDiv && messageDiv.parentNode) {
        messageDiv.remove();
      }
    }, type === 'success' ? 3000 : 5000);
  }
});
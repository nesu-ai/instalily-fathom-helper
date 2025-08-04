// Enhanced popup script
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  // Extension now runs in popup mode for all browsers
  document.body.classList.add('popup-mode');
  console.log('Running in popup mode for all browsers');
  
  // Get elements
  const loginSection = document.getElementById('login-section');
  const userSection = document.getElementById('user-section');
  const loadingSection = document.getElementById('loading-section');
  const googleLoginBtn = document.getElementById('google-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const addServiceItem = document.getElementById('add-service-item');
  const addServiceDropdown = document.getElementById('add-service-dropdown');
  const addServicesDialog = document.getElementById('add-services-dialog');
  const closeDialogBtn = document.getElementById('close-dialog');
  const serviceSearch = document.getElementById('service-search');
  const servicesGrid = document.getElementById('services-grid');
  
  // Configuration: Services supported by backend
  const BACKEND_SUPPORTED_SERVICES = ['fathom', 'circleback'];
  const COMING_SOON_SERVICES = [];
  
  // Full services list - all possible services
  const allServices = [
    { 
      id: 'fathom', 
      name: 'Fathom', 
      type: 'Meeting',
      url: 'https://fathom.video/users/sign_in',
      logo: `<img src="../icons/fathom-logo.svg" alt="Fathom" style="width: 24px; height: 24px;">`
    },
    { 
      id: 'circleback', 
      name: 'Circleback', 
      type: 'Meeting',
      url: 'https://app.circleback.ai/login',
      logo: `<img src="../icons/circleback.png" alt="Circleback" style="width: 24px; height: 24px;">`
    }
    // Commented out for Chrome Web Store compliance - easy to re-enable later
    /* 
    { 
      id: 'fireflies', 
      name: 'Fireflies', 
      type: 'Meeting',
      url: 'https://app.fireflies.ai/login',
      logo: `<img src="../icons/fireflies-logo.svg" alt="Fireflies" style="width: 24px; height: 24px;">`
    },
    { 
      id: 'zoom', 
      name: 'Zoom AI', 
      type: 'Meeting',
      url: 'https://zoom.us/signin',
      logo: `<img src="../icons/zoom.png" alt="Zoom" style="width: 24px; height: 24px;">`
    },
    { 
      id: 'teams', 
      name: 'Microsoft Teams', 
      type: 'Meeting',
      url: 'https://teams.microsoft.com',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #6264a7;">
        <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm0 4c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm6 12H6v-1.4c0-2 4-3.1 6-3.1s6 1.1 6 3.1V19z"/>
      </svg>`
    },
    { 
      id: 'meet', 
      name: 'Google Meet', 
      type: 'Meeting',
      url: 'https://meet.google.com',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #00897b;">
        <path d="M12 9l3.75-3.75V11l3.75-3.75v9.5L15.75 13v5.75L12 15v3.25a2 2 0 01-2 2H4.75a2 2 0 01-2-2V9.25a2 2 0 012-2H10a2 2 0 012 2V9z"/>
      </svg>`
    },
    { 
      id: 'webex', 
      name: 'Webex', 
      type: 'Meeting',
      url: 'https://webex.com',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #05b399;">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 11h8l-4 6z" fill="white"/>
      </svg>`
    },
    { 
      id: 'notion', 
      name: 'Notion', 
      type: 'Notes',
      url: 'https://notion.so',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #000000;">
        <path d="M4 4.5v15h16v-15H4zm2 2h12v11H6v-11zm2 2v7h8v-7H8zm2 2h4v3h-4v-3z"/>
      </svg>`
    },
    { 
      id: 'obsidian', 
      name: 'Obsidian', 
      type: 'Notes',
      url: 'https://obsidian.md',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #8b5cf6;">
        <path d="M12 2L2 12l10 10 10-10L12 2zm0 3.5L18.5 12 12 18.5 5.5 12 12 5.5z"/>
      </svg>`
    },
    { 
      id: 'slack', 
      name: 'Slack', 
      type: 'Communication',
      url: 'https://slack.com',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #611f69;">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.527 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
      </svg>`
    },
    { 
      id: 'discord', 
      name: 'Discord', 
      type: 'Communication',
      url: 'https://discord.com',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #5865F2;">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>`
    },
    { 
      id: 'dropbox', 
      name: 'Dropbox', 
      type: 'Storage',
      url: 'https://dropbox.com',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #0061ff;">
        <path d="M12 6.5L16.5 9.5L12 12.5L7.5 9.5L12 6.5M12 2L2 8L7 11L2 14L12 20L22 14L17 11L22 8L12 2Z"/>
      </svg>`
    },
    { 
      id: 'onedrive', 
      name: 'OneDrive', 
      type: 'Storage',
      url: 'https://onedrive.com',
      logo: `<svg viewBox="0 0 24 24" fill="currentColor" style="color: #0078d4;">
        <path d="M12.1 6.93l-.42 1.66c-.12.47-.5.8-.98.8H7.72c-.8 0-1.44.64-1.44 1.44v5.23c0 .8.64 1.44 1.44 1.44h8.56c.8 0 1.44-.64 1.44-1.44v-5.23c0-.8-.64-1.44-1.44-1.44h-2.4l.81-3.17c.18-.69-.42-1.32-1.13-1.2L12.1 6.93z"/>
      </svg>`
    }
    */
  ];
  
  // Filter services based on backend configuration
  const availableServices = allServices.filter(service => 
    BACKEND_SUPPORTED_SERVICES.includes(service.id) || COMING_SOON_SERVICES.includes(service.id)
  );
  
  console.log('Available services:', availableServices.map(s => s.name));
  
  let dropdownVisible = false;
  
  // Check authentication status on load
  checkAuthStatus();
  
  // Add event listeners
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  if (addServiceItem) {
    addServiceItem.addEventListener('click', showServicesDialog);
  }
  
  if (closeDialogBtn) {
    closeDialogBtn.addEventListener('click', hideServicesDialog);
  }
  
  if (serviceSearch) {
    serviceSearch.addEventListener('input', filterServices);
  }
  
  function checkAuthStatus() {
    console.log('Checking auth status...');
    
    // Check storage first for faster response
    chrome.storage.local.get(['user', 'platforms'], (stored) => {
      console.log('Initial storage check - platforms:', stored.platforms);
      if (stored.user) {
        // User exists in storage, show user section immediately without loading
        console.log('User found in storage, showing user section immediately');
        showUserSection(stored.user, stored.platforms || {});
        
        // Update with fresh data in background
        chrome.runtime.sendMessage({ action: 'checkAuthStatus' }, (response) => {
          if (response && response.isAuthenticated && response.user) {
            showUserSection(response.user, response.platforms || {});
          } else {
            showLoginSection();
          }
        });
      } else {
        // No user in storage, show loading then check
        showLoadingSection();
        
        // Add timeout for auth status check
        const timeoutId = setTimeout(() => {
          console.warn('Auth status check timed out');
          showLoginSection();
          showError('Unable to check authentication status. Please try again.');
        }, 5000);
        
        chrome.runtime.sendMessage({ action: 'checkAuthStatus' }, (response) => {
          clearTimeout(timeoutId);
          console.log('Auth status response:', response);
          
          if (chrome.runtime?.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            showLoginSection();
            showError('Extension error. Please reload the extension.');
            return;
          }
          
          if (response && response.isAuthenticated && response.user) {
            showUserSection(response.user, response.platforms || {});
          } else {
            showLoginSection();
            if (response && response.error) {
              showError(`Authentication check failed: ${response.error}`);
            }
          }
        });
      }
    });
  }
  
  function showLoginSection() {
    console.log('Showing login section');
    if (loadingSection) loadingSection.classList.add('hidden');
    if (loginSection) loginSection.classList.remove('hidden');
    if (userSection) userSection.classList.add('hidden');
  }
  
  function showUserSection(user, platforms) {
    console.log('Showing user section for:', user, platforms);
    if (loadingSection) loadingSection.classList.add('hidden');
    if (loginSection) loginSection.classList.add('hidden');
    if (userSection) userSection.classList.remove('hidden');
    
    // Update user info
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');
    
    if (userName) userName.textContent = user.name || 'Unknown User';
    if (userEmail) userEmail.textContent = user.email || 'No Email';
    if (userAvatar) userAvatar.src = user.picture || '../icons/icon-48.png';
    
    // Update connected services
    updateConnectedServices(platforms);
  }
  
  function updateConnectedServices(platforms) {
    console.log('updateConnectedServices called with platforms:', platforms);
    const connectedServicesDiv = document.getElementById('connected-services');
    connectedServicesDiv.innerHTML = '';
    
    // Show connected platforms
    if (platforms) {
      console.log('Available services for display:', availableServices.map(s => ({ id: s.id, name: s.name })));
      availableServices.forEach(service => {
        console.log(`Checking service ${service.id}:`, platforms[service.id]);
        if (platforms[service.id] && platforms[service.id].connected) {
          console.log(`Adding connected service: ${service.name}`);
          const serviceElement = createServiceElement(service.name, true, service.logo, null, service.id, platforms[service.id]);
          connectedServicesDiv.appendChild(serviceElement);
        }
      });
    }
    
    // Update dropdown to only show unconnected services
    updateAvailableServices(platforms);
  }
  
  function createServiceElement(name, connected, logo, status = null, serviceId = null, platformData = null) {
    const serviceDiv = document.createElement('div');
    serviceDiv.className = 'service-item';
    if (serviceId) {
      serviceDiv.setAttribute('data-service', serviceId);
    }
    
    let statusText = 'Not connected';
    let statusClass = 'disconnected';
    let actionButton = '';
    
    if (status === 'connecting') {
      statusText = 'Connecting...';
      statusClass = 'connecting';
      actionButton = '<div class="service-spinner"></div>';
    } else if (connected) {
      // Check if cookies need updating
      if (platformData && platformData.needsCookieUpdate) {
        statusText = 'Cookies Expired';
        statusClass = 'expired';
        actionButton = `<button class="service-action-btn refresh" data-service="${serviceId}" title="Refresh cookies">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
            <polyline points="23,4 23,10 17,10"></polyline>
            <polyline points="1,20 1,14 7,14"></polyline>
            <path d="m3.51,9a9,9 0 0,1 14.85,-3.36L23,10M1,14l4.64,4.36A9,9 0 0,0 20.49,15"></path>
          </svg>
        </button>`;
      } else {
        statusText = 'Connected';
        statusClass = 'connected';
        // All services can be removed
        actionButton = `<button class="service-action-btn remove" data-service="${serviceId}" title="Remove service">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>`;
      }
    }
    
    serviceDiv.innerHTML = `
      <div class="service-info">
        <span class="service-name">${name}</span>
        <span class="service-status ${statusClass}">
          ${statusText}
        </span>
      </div>
      ${actionButton}
    `;
    
    // Add click handlers for action buttons
    if (connected) {
      const removeBtn = serviceDiv.querySelector('.service-action-btn.remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleServiceRemove(serviceId, name);
        });
      }
      
      const refreshBtn = serviceDiv.querySelector('.service-action-btn.refresh');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleCookieRefresh(serviceId, name);
        });
      }
    }
    
    return serviceDiv;
  }
  
  function updateAvailableServices(platforms) {
    // Filter out already connected or connecting services for dropdown
    const unconnectedServices = availableServices.filter(service => {
      // Always show coming soon services
      if (COMING_SOON_SERVICES.includes(service.id)) {
        return true;
      }
      // For supported services, filter based on connection status
      return !platforms || !platforms[service.id] || 
        (!platforms[service.id].connected && !platforms[service.id].connecting);
    });
    
    // Hide add button if all supported services are connected or connecting
    const availableSupportedServices = unconnectedServices.filter(service => 
      BACKEND_SUPPORTED_SERVICES.includes(service.id)
    );
    
    if (availableSupportedServices.length === 0 && addServiceItem) {
      addServiceItem.style.display = 'none';
    } else if (addServiceItem) {
      addServiceItem.style.display = 'flex';
    }
  }
  
  function showLoadingSection() {
    if (loadingSection) loadingSection.classList.remove('hidden');
    if (loginSection) loginSection.classList.add('hidden');
    if (userSection) userSection.classList.add('hidden');
  }
  
  function handleGoogleLogin() {
    console.log('Login button clicked');
    
    // Show loading section immediately
    showLoadingSection();
    
    chrome.runtime.sendMessage({ action: 'googleAuth' }, (response) => {
      console.log('Auth response:', response);
      
      if (response && response.success) {
        console.log('Login successful, refreshing UI');
        // Small delay to ensure storage is updated
        setTimeout(() => {
          checkAuthStatus(); // Refresh the UI
        }, 500);
      } else {
        console.error('Login failed:', response?.error);
        
        // Return to login section on error
        showLoginSection();
        
        // Better error handling
        let errorMessage = 'Login failed. Please try again.';
        if (response?.error) {
          if (response.error.includes('window closed')) {
            errorMessage = 'Login was cancelled. Please try again and complete the sign-in process.';
          } else if (response.error.includes('timeout')) {
            errorMessage = 'Login timed out. Please try again.';
          } else {
            errorMessage = `Login failed: ${response.error}`;
          }
        }
        
        // Show error using the universal system
        showError(errorMessage);
      }
    });
  }
  
  function showLoginError(message) {
    // Create or update error message element
    let errorDiv = document.querySelector('.login-error');
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.className = 'login-error';
      googleLoginBtn.parentNode.insertBefore(errorDiv, googleLoginBtn.nextSibling);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
      if (errorDiv) {
        errorDiv.style.display = 'none';
      }
    }, 5000);
  }
  
  function handleLogout() {
    // Show loading state immediately
    logoutBtn.disabled = true;
    logoutBtn.innerHTML = `
      <div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
      Signing out...
    `;
    
    const timeoutId = setTimeout(() => {
      console.warn('Logout timed out');
      resetLogoutButton();
      showError('Logout timed out. Please try again.');
    }, 10000);
    
    chrome.runtime.sendMessage({ action: 'googleSignOut' }, (response) => {
      clearTimeout(timeoutId);
      resetLogoutButton();
      
      if (chrome.runtime?.lastError) {
        console.error('Logout runtime error:', chrome.runtime.lastError);
        showError('Error during logout. Please try again.');
        return;
      }
      
      if (response && response.success) {
        // Go directly to login page without success message
        checkAuthStatus(); // Refresh the UI
      } else {
        console.error('Logout failed:', response?.error);
        showError(response?.error || 'Logout failed. Please try again.');
      }
    });
  }
  
  function resetLogoutButton() {
    logoutBtn.disabled = false;
    logoutBtn.textContent = 'Sign Out';
  }
  
  function showError(message) {
    showMessage(message, 'error');
  }
  
  function showSuccess(message) {
    showMessage(message, 'success');
  }
  
  function showMessage(message, type = 'error') {
    // Remove any existing messages
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
  
  async function showServicesDialog() {
    console.log('Opening services dialog');
    
    // Get current platforms status
    const stored = await chrome.storage.local.get(['platforms']);
    const platforms = stored.platforms || {};
    
    // Filter unconnected services
    const unconnectedServices = availableServices.filter(service => 
      !platforms[service.id] || !platforms[service.id].connected
    );
    
    // Populate services grid
    populateServicesGrid(unconnectedServices);
    
    // Show dialog
    addServicesDialog.classList.remove('hidden');
    
    // Focus search input
    if (serviceSearch) {
      serviceSearch.value = '';
      serviceSearch.focus();
    }
  }
  
  function hideServicesDialog() {
    console.log('Closing services dialog');
    addServicesDialog.classList.add('hidden');
  }
  
  function populateServicesGrid(services, isFiltered = false) {
    servicesGrid.innerHTML = '';
    
    if (services.length === 0) {
      const message = isFiltered 
        ? 'No services found matching your search.' 
        : 'All services connected!';
      servicesGrid.innerHTML = `<p style="text-align: center; grid-column: 1 / -1; padding: 40px; color: #6b7280;">${message}</p>`;
      return;
    }
    
    services.forEach(service => {
      const card = document.createElement('div');
      const isComingSoon = COMING_SOON_SERVICES.includes(service.id);
      
      card.className = `service-card ${isComingSoon ? 'coming-soon' : ''}`;
      card.innerHTML = `
        <div class="service-card-header">
          <div class="service-card-icon">${service.logo}</div>
          <div class="service-card-content">
            <span class="service-card-name">${service.name}</span>
            ${isComingSoon ? '<div class="service-card-status">Coming Soon</div>' : ''}
          </div>
        </div>
      `;
      
      if (!isComingSoon) {
        card.addEventListener('click', () => {
          handleServiceConnect(service);
          hideServicesDialog();
        });
      }
      
      servicesGrid.appendChild(card);
    });
  }
  
  async function filterServices() {
    const searchTerm = serviceSearch.value.toLowerCase();
    
    // Get current platforms status
    const stored = await chrome.storage.local.get(['platforms']);
    const platforms = stored.platforms || {};
    
    // Filter services based on search and connection status
    const filteredServices = availableServices.filter(service => {
      // Always show coming soon services in search
      if (COMING_SOON_SERVICES.includes(service.id)) {
        const matchesSearch = service.name.toLowerCase().includes(searchTerm) || 
                            service.type.toLowerCase().includes(searchTerm);
        return matchesSearch;
      }
      
      // For supported services, filter based on connection status and search
      const isUnconnected = !platforms[service.id] || !platforms[service.id].connected;
      const matchesSearch = service.name.toLowerCase().includes(searchTerm) || 
                          service.type.toLowerCase().includes(searchTerm);
      return isUnconnected && matchesSearch;
    });
    
    populateServicesGrid(filteredServices, searchTerm.length > 0);
  }
  
  function handleServiceConnect(service) {
    console.log(`Harvesting cookies for ${service.name}...`);
    
    // Immediately show connecting state in UI
    updateServiceConnecting(service);
    
    // Use our new cookie harvesting backend
    chrome.runtime.sendMessage({ 
      action: 'harvestCookies', 
      platform: service.id 
    }, (response) => {
      if (response && response.success) {
        console.log(`Successfully harvested cookies for ${service.name}`);
        // Update UI to show as connected
        updateServiceConnected(service, response.cookiesCount);
        showSuccess(`Successfully harvested ${response.cookiesCount || 'multiple'} cookies from ${service.name}`);
      } else {
        console.error(`Cookie harvesting failed for ${service.name}:`, response?.error);
        // Remove connecting state
        removeServiceConnecting(service);
        showError(response?.error || `Failed to harvest cookies from ${service.name}`);
      }
    });
    
    // Hide the dialog
    hideServicesDialog();
  }
  
  function updateServiceConnecting(service) {
    // Find the service in connected services and update it to show connecting state
    const connectedServicesDiv = document.getElementById('connected-services');
    
    // Remove any existing element for this service first
    const existingElement = connectedServicesDiv.querySelector(`[data-service="${service.id}"]`);
    if (existingElement) {
      existingElement.remove();
    }
    
    // Create connecting service element
    const connectingService = createServiceElement(service.name, false, service.logo, 'connecting', service.id);
    connectedServicesDiv.appendChild(connectingService);
    
    // Update available services to remove this one
    const stored = chrome.storage.local.get(['platforms']).then((stored) => {
      const platforms = stored.platforms || {};
      platforms[service.id] = { connected: false, connecting: true };
      chrome.storage.local.set({ platforms });
      updateAvailableServices(platforms);
    });
  }
  
  function startConnectionMonitoring(service) {
    console.log(`Starting connection monitoring for ${service.name}`);
    
    // Poll for connection status every 2 seconds
    const checkInterval = setInterval(() => {
      chrome.storage.local.get(['platforms'], (stored) => {
        const platforms = stored.platforms || {};
        const platformStatus = platforms[service.id];
        
        if (platformStatus && platformStatus.connected && !platformStatus.connecting) {
          // Connection successful
          console.log(`${service.name} connected successfully`);
          clearInterval(checkInterval);
          
          // Update UI to show connected state
          updateConnectedServices(platforms);
        }
      });
    }, 2000);
    
    // Stop monitoring after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
      console.log(`Connection monitoring timeout for ${service.name}`);
    }, 300000);
  }
  
  // Update service to connected state after successful cookie harvesting
  function updateServiceConnected(service, cookiesCount) {
    console.log('updateServiceConnected called for:', service.name, service.id);
    // Find and update the connecting service element
    const connectedServicesDiv = document.getElementById('connected-services');
    const allElements = connectedServicesDiv.querySelectorAll('[data-service]');
    console.log('All service elements:', Array.from(allElements).map(el => el.getAttribute('data-service')));
    
    const connectingElement = connectedServicesDiv.querySelector(`[data-service="${service.id}"]`);
    console.log('Found connecting element:', connectingElement);
    
    if (connectingElement) {
      // Replace with connected element
      const connectedElement = createServiceElement(service.name, true, service.logo, null, service.id);
      connectedElement.title = `Harvested ${cookiesCount || 'multiple'} cookies`;
      connectingElement.replaceWith(connectedElement);
    } else {
      // Add new connected element
      const connectedElement = createServiceElement(service.name, true, service.logo, null, service.id);
      connectedElement.title = `Harvested ${cookiesCount || 'multiple'} cookies`;
      connectedServicesDiv.appendChild(connectedElement);
    }
    
    // Update stored platforms state
    chrome.storage.local.get(['platforms']).then((stored) => {
      const platforms = stored.platforms || {};
      platforms[service.id] = { connected: true, connecting: false, lastHarvest: Date.now(), cookiesCount };
      chrome.storage.local.set({ platforms });
      updateAvailableServices(platforms);
      
      // Refresh the entire connected services list to ensure consistency
      updateConnectedServices(platforms);
    });
  }
  
  // Remove service connecting state
  function removeServiceConnecting(service) {
    const connectedServicesDiv = document.getElementById('connected-services');
    const connectingElement = connectedServicesDiv.querySelector(`[data-service="${service.id}"]`);
    
    if (connectingElement) {
      connectingElement.remove();
    }
    
    // Update available services to show this service again
    updateAvailableServices({});
  }

  // Handle cookie refresh for expired services
  async function handleCookieRefresh(serviceId, serviceName) {
    console.log(`Refreshing cookies for: ${serviceName} (${serviceId})`);
    
    // Find the service object
    const service = availableServices.find(s => s.id === serviceId);
    if (!service) {
      showError(`Service ${serviceName} not found`);
      return;
    }
    
    // Use the same flow as connecting a new service
    handleServiceConnect(service);
  }

  // Handle service removal
  async function handleServiceRemove(serviceId, serviceName) {
    console.log(`Removing service: ${serviceName} (${serviceId})`);
    
    // Show confirmation
    if (!confirm(`Remove ${serviceName}? This will disconnect the service and remove its data.`)) {
      return;
    }
    
    try {
      // Get current platforms
      const stored = await chrome.storage.local.get(['platforms']);
      const platforms = stored.platforms || {};
      
      // Remove the service from local storage
      if (platforms[serviceId]) {
        delete platforms[serviceId];
        await chrome.storage.local.set({ platforms });
        console.log(`Removed ${serviceName} from local storage`);
      }
      
      // Remove from Firestore via service worker
      try {
        const response = await chrome.runtime.sendMessage({ 
          action: 'removePlatform', 
          platform: serviceId 
        });
        
        if (response && response.success) {
          console.log(`✅ ${serviceName} removed from Firestore successfully`);
        } else {
          console.warn(`⚠️ Failed to remove ${serviceName} from Firestore:`, response?.error);
          // Show warning but don't fail the entire operation
          showError(`Local removal successful, but failed to remove from cloud: ${response?.error || 'Unknown error'}`);
        }
      } catch (firestoreError) {
        console.warn(`⚠️ Failed to communicate with service worker for Firestore removal:`, firestoreError);
        // Continue with local removal success
      }
      
      // Update UI
      updateConnectedServices(platforms);
      
      // Show success message
      showSuccess(`${serviceName} has been removed successfully`);
      
    } catch (error) {
      console.error(`Error removing ${serviceName}:`, error);
      showError(`Failed to remove ${serviceName}. Please try again.`);
    }
  }
});
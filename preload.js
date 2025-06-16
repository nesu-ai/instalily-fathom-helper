const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startGoogleOAuth: () => ipcRenderer.invoke('start-google-oauth'),
  startLogin: () => ipcRenderer.invoke('start-login'),
  checkSession: () => ipcRenderer.invoke('check-session'),
  logout: () => ipcRenderer.invoke('logout'),
  closeApp: () => ipcRenderer.invoke('close-app')
});

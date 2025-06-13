const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startGoogleOAuth: () => ipcRenderer.invoke('start-google-oauth'),
  startLogin: () => ipcRenderer.invoke('start-login')
});
